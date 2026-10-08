const extract = require('extract-zip')
const fs = require('fs')
const path = require('path')
const dats = require('./dats.json')

// How many Redump downloads to run at once. Kept low to be polite to redump.org.
const CONCURRENCY = 1

// How long a Redump download is reused before it is fetched again. Redump adds
// dumps most days, so a day keeps repeated runs from refetching everything
// while a refresh still picks up the newest datfiles.
const MAX_AGE = 24 * 60 * 60 * 1000

module.exports = async function downloadAll(options = {}) {
	await redump(options)
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
async function redumpDownload(element, {force = false} = {}) {
	const destDir = path.join(__dirname, 'input/redump', element)
	const partDir = destDir + '.part'
	const downloads = [
		// Cue sheets only exist for CD-based systems. For the others, redump
		// responds with an HTML page instead of a zip, which is fine to skip.
		{url: `http://redump.org/cues/${element}/serial,version`, zipFile: 'cue.zip', optional: true},
		{url: `http://redump.org/datfile/${element}/serial,version`, zipFile: 'dat.zip'},
	]

	if (!force && isFresh(path.join(destDir, 'dat.zip'))) {
		return
	}
	console.log(`Downloading: ${element}`)

	// The system is fetched into a directory of its own, which replaces the
	// previous one only once everything arrived. Replacing it rather than
	// extracting over it matters: datfiles carry their date in the filename,
	// so the previous one would otherwise sit beside the new one, and both
	// would match the same pattern. Fetching it aside keeps the previous one
	// in place when Redump cannot be reached.
	fs.rmSync(partDir, {recursive: true, force: true})
	try {
		for (const {url, zipFile, optional} of downloads) {
			const file = path.join(partDir, zipFile)
			await downloadFile(url, file)
			if (!isZip(file)) {
				if (optional) {
					console.log(`No cue sheets for ${element}`)
					fs.rmSync(file)
					continue
				}
				throw new Error(`Response is not a zip file for ${url}`)
			}
			await extractFile(file, partDir)
		}
		fs.rmSync(destDir, {recursive: true, force: true})
		fs.renameSync(partDir, destDir)
	} finally {
		fs.rmSync(partDir, {recursive: true, force: true})
	}
}

/**
 * Whether the given download exists, and is recent enough to reuse.
 */
function isFresh(file) {
	try {
		return Date.now() - fs.statSync(file).mtimeMs < MAX_AGE
	} catch {
		return false
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

/**
 * The Redump systems the DATs are actually built from, taken from dats.json so
 * that the download list cannot drift away from the build. A hand-kept list
 * ended up fetching dozens of systems nothing ever read.
 */
function redumpSystems() {
	const systems = new Set()
	for (const datsInfo of Object.values(dats)) {
		if (datsInfo.disabled) {
			continue
		}
		for (const pattern of datsInfo.files || []) {
			const match = /^input\/redump\/([^/]+)\//.exec(pattern)
			if (match) {
				systems.add(match[1])
			}
		}
	}
	return [...systems].sort()
}

async function redump(options = {}) {
	const systems = redumpSystems()
	console.log(`Downloading Redump for ${systems.length} systems`)
	fs.mkdirSync(path.join(__dirname, 'input/redump'), {recursive: true})

	// Download a few systems at a time, and keep going when one fails.
	const queue = [...systems]
	const failures = []
	async function worker() {
		let element
		while ((element = queue.shift()) !== undefined) {
			try {
				await redumpDownload(element, options)
			} catch (err) {
				console.error(`Failed to download ${element}: ${err.message}`)
				failures.push(element)
			}
		}
	}
	await Promise.all(Array.from({length: CONCURRENCY}, worker))

	// A source being unreachable should not stop the DATs whose input files are
	// already on disk from rebuilding, so this is reported rather than thrown.
	// Whatever ends up without input shows up in the run summary.
	if (failures.length > 0) {
		console.error(`Failed to download from Redump: ${failures.join(', ')}`)
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

module.exports.redumpSystems = redumpSystems
