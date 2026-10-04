const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const {getOptions} = require('..')
const {redumpSystems} = require('../download')
const dats = require('../dats.json')

// Everything an entry in dats.json is allowed to carry. A key outside this set
// is almost always a typo, and a typo means the entry silently stops building:
// "files-ignore-missing-serial" kept ten DATs out of the build for over a year.
const KNOWN_KEYS = ['files', 'disabled']

test('every DAT is configured with known keys only', function () {
	for (const [name, datsInfo] of Object.entries(dats)) {
		for (const key of Object.keys(datsInfo)) {
			assert.ok(KNOWN_KEYS.includes(key), `${name} has an unknown key "${key}", expected one of ${KNOWN_KEYS.join(', ')}`)
		}
	}
})

test('every DAT has file patterns to build from', function () {
	for (const [name, datsInfo] of Object.entries(dats)) {
		assert.ok(Array.isArray(datsInfo.files), `${name} has no files array`)
		assert.ok(datsInfo.files.length > 0, `${name} has no file patterns`)
		for (const pattern of datsInfo.files) {
			assert.strictEqual(typeof pattern, 'string', `${name} has a non-string pattern`)
			assert.ok(pattern.length > 0, `${name} has an empty pattern`)
		}
	}
})

test('every DAT builds from a source that can be obtained', function () {
	// Anything else is a dead entry: darkwater patterns sat in here for years
	// with nothing able to download them.
	const sources = ['input/no-intro/', 'input/tosec/', 'input/redump/', 'static/']
	for (const [name, datsInfo] of Object.entries(dats)) {
		for (const pattern of datsInfo.files) {
			assert.ok(
				sources.some((source) => pattern.startsWith(source)),
				`${name} builds from "${pattern}", which is not one of ${sources.join(', ')}`
			)
		}
	}
})

test('every disabled DAT says why', function () {
	for (const [name, datsInfo] of Object.entries(dats)) {
		if ('disabled' in datsInfo) {
			assert.strictEqual(typeof datsInfo.disabled, 'string', `${name} is disabled without a reason`)
			assert.ok(datsInfo.disabled.length > 0, `${name} is disabled without a reason`)
		}
	}
})

test('every DAT is written into the database submodule', function () {
	for (const name of Object.keys(dats)) {
		assert.ok(name.startsWith('database/metadat/'), `${name} is not written into database/metadat`)
		assert.strictEqual(fs.existsSync(path.dirname(name)), true, `${path.dirname(name)} does not exist to write ${name} into`)
	}
})

test('no DAT is configured twice', function () {
	// JSON.parse keeps the last of a repeated key, so the raw text is the only
	// place a duplicate shows up.
	const raw = fs.readFileSync(path.join(__dirname, '..', 'dats.json'), 'utf8')
	const keys = [...raw.matchAll(/^\t"([^"]+)": \{$/gm)].map((match) => match[1])
	assert.strictEqual(keys.length, Object.keys(dats).length, 'dats.json has a repeated DAT name')
})

test('the Redump systems to download come from the DATs that use them', function () {
	const systems = redumpSystems()
	assert.ok(systems.length > 0)

	// Every system is one some DAT actually builds from, so the download can no
	// longer drift into fetching systems nothing reads.
	const patterns = Object.values(dats).flatMap((datsInfo) => datsInfo.files)
	for (const system of systems) {
		assert.ok(
			patterns.some((pattern) => pattern.startsWith(`input/redump/${system}/`)),
			`${system} is downloaded but no DAT builds from it`
		)
	}

	// And every Redump system a DAT builds from gets downloaded.
	for (const pattern of patterns) {
		const match = /^input\/redump\/([^/]+)\//.exec(pattern)
		if (match) {
			assert.ok(systems.includes(match[1]), `${match[1]} is built from but never downloaded`)
		}
	}
})

test('leaves disabled DATs out of the Redump download', function () {
	const disabled = Object.entries(dats)
		.filter(([, datsInfo]) => datsInfo.disabled)
		.flatMap(([, datsInfo]) => datsInfo.files)
		.map((pattern) => /^input\/redump\/([^/]+)\//.exec(pattern))
		.filter(Boolean)
		.map((match) => match[1])

	const systems = redumpSystems()
	for (const system of disabled) {
		// Unless some other DAT that is still enabled needs it too.
		const stillUsed = Object.values(dats).some((datsInfo) =>
			!datsInfo.disabled && datsInfo.files.some((pattern) => pattern.startsWith(`input/redump/${system}/`)))
		if (!stillUsed) {
			assert.ok(!systems.includes(system), `${system} is only used by a disabled DAT, but is still downloaded`)
		}
	}
})

test('reads the build options off the command line', function () {
	assert.deepStrictEqual(getOptions([]), {'skip-download': false, 'force-download': false})
	assert.deepStrictEqual(getOptions(['--skip-download']), {'skip-download': true, 'force-download': false})
	assert.deepStrictEqual(getOptions(['--force-download']), {'skip-download': false, 'force-download': true})
})

test('rejects an unknown build option', function () {
	assert.throws(() => getOptions(['--nope']), /nope/)
})
