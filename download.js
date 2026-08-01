const extract = require('extract-zip')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

// How many Redump downloads to run at once. Kept low to be polite to redump.org.
const CONCURRENCY = 1

module.exports = async function downloadAll() {
	//await nointro()
	//await tosec()
	await redump()
}

async function tosec() {
	const zipFile = path.join(__dirname, 'tosec.zip')
	const destDir = path.join(__dirname, 'input/tosec')

	if (!fs.existsSync(zipFile)) {
		console.log('Downloading TOSEC')
		await downloadFile('https://www.tosecdev.org/downloads/category/59-2025-03-13?download=117:tosec-dat-pack-complete-4743-tosec-v2025-03-13', zipFile, {method: 'POST'})
	}

	if (!fs.existsSync(destDir)) {
		await extractFile(zipFile, destDir)
	}
}

async function nointro() {
	const zipFile = path.join(__dirname, 'nointro.zip')
	const destDir = path.join(__dirname, 'input/no-intro')

	if (!fs.existsSync(zipFile)) {
		console.log('Downloading No-Intro')
		const downloadPath = __dirname
		const browser = await puppeteer.launch({
			headless: true // change to false to show browser window while debugging
		})
		try {
			const page = await browser.newPage()
			const client = await page.createCDPSession()
			await client.send('Page.setDownloadBehavior', {
				behavior: 'allow',
				downloadPath,
			})
			await page.goto('https://datomatic.no-intro.org/index.php?page=download&op=daily')
			await page.waitForSelector('input[value="Request"]')
			await page.click('input[value="Request"]')
			await page.waitForSelector('input[value="Download"]')
			await page.click('input[value="Download"]')

			const downloaded = await waitForDownload(downloadPath)
			fs.renameSync(downloaded, zipFile)
		} finally {
			await browser.close()
		}
	}

	if (!fs.existsSync(destDir)) {
		await extractFile(zipFile, destDir)
	}
}

/**
 * Poll the given directory until a No-Intro zip download appears.
 */
function waitForDownload(dir, timeout = 5 * 60 * 1000) {
	return new Promise(function (resolve, reject) {
		let elapsed = 0
		const interval = 1000
		const timer = setInterval(function () {
			const content = fs.readdirSync(dir)
			const file = content.find((f) => f.startsWith('No-Intro') && f.endsWith('.zip'))
			if (file) {
				clearInterval(timer)
				// Give the file a moment to finish writing to disk.
				setTimeout(() => resolve(path.join(dir, file)), 500)
			} else if ((elapsed += interval) >= timeout) {
				clearInterval(timer)
				reject(new Error('Timed out waiting for the No-Intro download to finish'))
			}
		}, interval)
	})
}

/**
 * Extract the given zip file to the destination directory.
 */
async function extractFile(source, dest) {
	console.log('Extracting ' + source)
	fs.mkdirSync(dest, {recursive: true})
	await extract(source, {dir: dest})
}

/**
 * Download and extract the DAT and cue sheets for a single Redump system.
 */
async function redumpDownload(element) {
	const destDir = path.join(__dirname, 'input/redump', element)
	const downloads = [
		// Cue sheets only exist for CD-based systems. For the others, redump
		// responds with an HTML page instead of a zip, which is fine to skip.
		{url: `http://redump.org/datfile/${element}/serial,version`, zipFile: path.join(destDir, 'dat.zip')},
		{url: `http://redump.org/cues/${element}/serial,version`, zipFile: path.join(destDir, 'cue.zip'), optional: true},
	]

	for (const {url, zipFile, optional} of downloads) {
		// The zip is downloaded and extracted through a temporary file, so its
		// final name only exists once both steps completed. That makes it safe
		// to skip on re-runs after an interrupted download.
		if (fs.existsSync(zipFile)) {
			continue
		}
		const partFile = zipFile + '.part'
		try {
			await downloadFile(url, partFile)
			if (!isZip(partFile)) {
				if (optional) {
					console.log(`No cue sheets for ${element}`)
					continue
				}
				throw new Error(`Response is not a zip file for ${url}`)
			}
			await extractFile(partFile, destDir)
			fs.renameSync(partFile, zipFile)
		} finally {
			fs.rmSync(partFile, {force: true})
		}
	}
}

/**
 * Check whether the given file starts with the zip magic bytes.
 */
function isZip(file) {
	const buffer = Buffer.alloc(2)
	const fd = fs.openSync(file, 'r')
	try {
		fs.readSync(fd, buffer, 0, 2, 0)
	} finally {
		fs.closeSync(fd)
	}
	return buffer.toString('latin1') === 'PK'
}

async function redump() {
	console.log('Downloading Redump')
	fs.mkdirSync(path.join(__dirname, 'input/redump'), {recursive: true})
	const systems = [
		'arch',
		'mac',
		'ajcd',
		'pippin',
		'qis',
		'acd',
		'cd32',
		'cdtv',
		'fmt',
		'fpp',
		'pc',
		'ite',
		'kea',
		'kfb',
		'ksgv',
		'ixl',
		'hs',
		'vis',
		'xbox',
		'xbox360',
		'trf',
		'ns246',
		'pce',
		'pc-88',
		'pc-98',
		'pc-fx',
		'ngcd',
		'gc',
		'wii',
		'palm',
		'3do',
		'cdi',
		'photo-cd',
		'psxgs',
		'ppc',
		'chihiro',
		'dc',
		'mcd',
		'naomi',
		'naomi2',
		'sp21',
		'sre',
		'sre2',
		'ss',
		'x68k',
		'psx',
		'ps2',
		'ps3',
		'psp',
		'quizard',
		'ksite',
		'nuon',
		'vflash',
		'gamewave'
	]

	// Download a few systems at a time, and keep going when one fails.
	const queue = [...systems]
	const failures = []
	async function worker() {
		let element
		while ((element = queue.shift()) !== undefined) {
			console.log(`Downloading: ${element}`)
			try {
				await redumpDownload(element)
			} catch (err) {
				console.error(`Failed to download ${element}: ${err.message}`)
				failures.push(element)
			}
		}
	}
	await Promise.all(Array.from({length: CONCURRENCY}, worker))

	if (failures.length > 0) {
		throw new Error('Failed to download from Redump: ' + failures.join(', '))
	}
}

/**
 * Download the given URL to the destination file.
 */
async function downloadFile(url, dest, options = {}) {
	fs.mkdirSync(path.dirname(dest), {recursive: true})
	const response = await fetch(url, options)
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`)
	}
	fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()))
}
