const extract = require('extract-zip')
const fs = require('fs')
const path = require('path')
const dats = require('./dats.json')

// How many Redump downloads to run at once. Kept low to be polite to Redump.
const CONCURRENCY = 1

// Where Redump serves its datfiles and cue sheets.
const REDUMP_URL = 'https://redump.info'

// How long a Redump download is reused before it is fetched again. Redump adds
// dumps most days, so a day keeps repeated runs from refetching everything
// while a refresh still picks up the newest datfiles.
const MAX_AGE = 24 * 60 * 60 * 1000

// How long a download may take, reading the body included. The largest of the
// zips is a few megabytes, so this only gives up on a connection that stalled,
// which would otherwise hang the run with no error at all.
const TIMEOUT = 5 * 60 * 1000

// How many times a failed download is tried again, waiting RETRY_DELAY before
// the first retry and twice as long before each one after it.
const RETRIES = 2
const RETRY_DELAY = 10 * 1000

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
		// Cue sheets only exist for CD-based systems. For the others, Redump
		// responds with a 404 instead of a zip, which is fine to skip.
		{url: `${REDUMP_URL}/cues/${element}`, zipFile: 'cue.zip', optional: true},
		{url: `${REDUMP_URL}/datfile/${element}/serial,version`, zipFile: 'dat.zip'},
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
			const found = await downloadFile(url, file, {optional})
			if (!found || !isZip(file)) {
				if (optional) {
					console.log(`No cue sheets for ${element}`)
					fs.rmSync(file, {force: true})
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
 *
 * Returns false when an optional file is not found, rather than throwing. A
 * timeout, a dropped connection or a server error is tried again, while any
 * other response the server gives would only come back the same.
 */
async function downloadFile(url, dest, {optional = false, retries = RETRIES, retryDelay = RETRY_DELAY} = {}) {
	fs.mkdirSync(path.dirname(dest), {recursive: true})
	for (let attempt = 0; ; attempt++) {
		try {
			// The signal covers reading the body as well, which is where a large
			// zip spends most of its time.
			const response = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT)})
			if (optional && response.status === 404) {
				return false
			}
			if (!response.ok) {
				const err = new Error(`HTTP ${response.status} ${response.statusText} for ${url}`)
				err.retry = response.status >= 500 || response.status === 429
				throw err
			}
			fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()))
			return true
		} catch (err) {
			if (attempt >= retries || err.retry === false) {
				throw err
			}
			console.log(`Retrying ${url} after: ${err.message}`)
			await new Promise((resolve) => setTimeout(resolve, retryDelay * 2 ** attempt))
		}
	}
}

module.exports.downloadFile = downloadFile
module.exports.redumpSystems = redumpSystems
