const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {downloadFile} = require('../download')

const URL = 'https://redump.info/datfile/psx/serial,version'

/**
 * Run downloadFile() against a stubbed fetch, which hands out the given
 * responses in turn. Hands back what was written, and the calls made.
 */
async function download(responses, options = {}) {
	const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'libretro-dats-download-')), 'dat.zip')
	const calls = []
	const fetch = globalThis.fetch
	const log = console.log
	globalThis.fetch = async (url, init) => {
		calls.push({url, init})
		const next = responses.shift()
		if (next instanceof Error) {
			throw next
		}
		return next
	}
	console.log = () => {}
	try {
		const found = await downloadFile(URL, dest, {retryDelay: 0, ...options})
		return {found, calls, contents: fs.existsSync(dest) ? fs.readFileSync(dest, 'latin1') : null}
	} finally {
		globalThis.fetch = fetch
		console.log = log
	}
}

test('downloads a file with a timeout', async function () {
	const {found, calls, contents} = await download([new Response('PK zip')])
	assert.strictEqual(found, true)
	assert.strictEqual(contents, 'PK zip')
	assert.strictEqual(calls.length, 1)
	assert.ok(calls[0].init.signal instanceof AbortSignal)
})

test('tries a download again after a timeout or a server error', async function () {
	const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
	const {found, calls, contents} = await download([timeout, new Response('', {status: 503}), new Response('PK zip')])
	assert.strictEqual(found, true)
	assert.strictEqual(contents, 'PK zip')
	assert.strictEqual(calls.length, 3)
})

test('gives up on a download once the retries run out', async function () {
	const responses = [new TypeError('fetch failed'), new TypeError('fetch failed'), new TypeError('fetch failed')]
	await assert.rejects(download(responses), /fetch failed/)
	assert.strictEqual(responses.length, 0)
})

test('does not retry a response that would only come back the same', async function () {
	const responses = [new Response('', {status: 403, statusText: 'Forbidden'}), new Response('PK zip')]
	await assert.rejects(download(responses), /HTTP 403 Forbidden/)
	assert.strictEqual(responses.length, 1)
})

test('skips an optional file that is not found, without retrying', async function () {
	const responses = [new Response('', {status: 404}), new Response('PK zip')]
	const {found, contents} = await download(responses, {optional: true})
	assert.strictEqual(found, false)
	assert.strictEqual(contents, null)
	assert.strictEqual(responses.length, 1)
})
