const mkdirp = require('mkdirp')
const extract = require('extract-zip')
const fs = require('fs')
const request = require('request')
const path = require('path')
const download = require('download')
const puppeteer = require('puppeteer')

module.exports = async function download() {
	//await nointro()
	//await tosec()
	mkdirp.sync('input/redump')
	//await redump()
}

function tosec() {
	return new Promise(function(resolve, reject) {
		if (fs.existsSync('tosec.zip')) {
			if (!fs.existsSync('input/tosec')) {
				mkdirp.sync('input/tosec')
				extractFile('tosec.zip', 'input/tosec').then(resolve, reject).catch(reject)
			}
			else {
				resolve();
			}
		} else {
			console.log('Downloading TOSEC')
			request.post('https://www.tosecdev.org/downloads/category/57-2023-07-10?download=112:tosec-dat-pack-complete-3983-tosec-v2023-07-10')
			.on('error', function(err) {
				reject(err)
			})
			.on('finish', function(err) {
				if (err) {
					return reject(err)
				} else {
					setTimeout(function() {
						extractFile('tosec.zip', 'input/tosec').then(resolve, reject).catch(reject)
					}, 500)
				}
			})
			.pipe(fs.createWriteStream('tosec.zip'))
		}
	})
}

function nointro() {
	return new Promise(async function(resolve, reject) {
		if (fs.existsSync('nointro.zip')) {
			if (!fs.existsSync('input/no-intro')) {
				extractFile('nointro.zip', 'input/no-intro').then(resolve, reject).catch(reject)
			}
			else {
				resolve();
			}
		} else {
			console.log('Downloading No-Intro')
			const downloadPath = process.cwd()
			const browser = await puppeteer.launch({
				headless: true // change to false to show browser window while debugging
			})
			const page = await browser.newPage()
			const client = await page.target().createCDPSession()
			await client.send('Page.setDownloadBehavior', {
				behavior: 'allow',
				downloadPath,
			})
			await page.goto('https://datomatic.no-intro.org/index.php?page=download&op=daily')
			await page.waitForSelector('input[value="Request"]')
			await page.click('input[value="Request"]')
			await page.waitForSelector('input[value="Download"]')
			await page.click('input[value="Download"]')
			// Wait until zip download finish
			const timer = setInterval(() => {
				const content = fs.readdirSync(downloadPath)
				const filePath = content.find((f) => f.startsWith('No-Intro') && f.endsWith('.zip'))
				if (filePath) {
					setTimeout(function() {
						fs.renameSync(filePath, 'nointro.zip')
						extractFile('nointro.zip', 'input/no-intro').then(resolve, reject).catch(reject)
					}, 500)
					clearInterval(timer)
				}
			}, 1000)
		}
	})
}

function extractFile(source, dest) {
	console.log('extract ' + source)
	return new Promise(function(resolve, reject) {
		console.log('Extracting ' + source)
		const destDir = __dirname + '/' + dest
		mkdirp.sync(destDir)
		extract(source, {dir: destDir}, function (err) {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}

async function redumpDownload(element) {
	// Uncomment this to skip downloading Redump
	//return
	const redumpDatDownload = `input/redump/${element}/dat.zip`

	if (!fs.existsSync(redumpDatDownload)) {
		await downloadFile(`http://redump.org/datfile/${element}/serial,version`, redumpDatDownload)
	}

	const cueDownload = `input/redump/${element}/cue.zip`
	if (!fs.existsSync(cueDownload)) {
		await downloadFile(`http://redump.org/cues/${element}/serial,version`, cueDownload)
	}
}

async function redump() {
	console.log('redump!')
	mkdirp.sync('input/redump')
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
	for (let element of systems) {
		console.log(element)
		await redumpDownload(element)
	}
	/*
	systems.forEach(async (system) => {
		console.log(system)
		//await downloadFile(`http://redump.org/datfile/${system}/`, `input/redump/${system}.zip`)
		//await extractFile(`input/redump/${system}.zip`, 'input/redump')

	})*/


		//

	/*var promises = systems.map(redumpDownload)
	await Promise.all(promises)
	promises = systems.map(redumpExtract)
	await Promise.all(promises)*/

	/*
	for (var element of systems) {
		await downloadFile(`http://redump.org/datfile/${element}/`, `input/redump/${element}.zip`)
		await extractFile(`input/redump/${element}.zip`, 'input/redump')
	}*/
	/*systems.forEach(async function (element) {
		setTimeout(async function () {
			await extractFile(`input/redump/${element}.zip`, 'input/redump')
		}, 500)
	})*/
}

async function downloadFile(url, dest) {
	const destDir = __dirname + '/' + dest
	const finalDir = path.dirname(destDir)
	if (!fs.existsSync(finalDir)) {
		fs.mkdirSync(finalDir);
	}
	await download(url, finalDir, {
		extract: true
	})
}

function downloadFile2(url, dest) {
	return new Promise(function (resolve, reject) {
		const destDir = __dirname + '/' + dest
		if (!fs.existsSync(destDir)) {
			console.log('Downloading ' + url)

			fetch(url)

			request.get(url)
			.on('error', function(err) {
				console.error('Error on download ', url, dest)
				reject(err)
			})
			.on('finish', function(err) {
				if (err) {
					console.error('Failed finish to download ', url, dest)
					reject(err)
				} else {
					console.log('finished ', dest)
					resolve()
				}
			})
			.pipe(fs.createWriteStream(destDir))
			resolve();
		} else {
			resolve()
		}
	})
}
