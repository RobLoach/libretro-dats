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

test('every DAT is written into the database submodule', function (t) {
	for (const name of Object.keys(dats)) {
		assert.ok(name.startsWith('database/metadat/'), `${name} is not written into database/metadat`)
	}

	// Checking that the directories exist only means something where the
	// submodule is checked out, which CI does not bother with as it never
	// runs a build.
	const repo = path.join(__dirname, '..')
	if (!fs.existsSync(path.join(repo, 'database', 'metadat'))) {
		t.skip('the database submodule is not checked out')
		return
	}

	// The 147 DATs share four directories, so there is no point stat-ing each.
	for (const dir of new Set(Object.keys(dats).map((name) => path.dirname(name)))) {
		assert.strictEqual(fs.existsSync(path.join(repo, dir)), true, `${dir} does not exist to write DATs into`)
	}
})

test('every DAT that builds from TOSEC says so in its name', function () {
	// cleanGameName() decides whether to translate two-letter country codes by
	// looking for "/tosec/" in the DAT name, so the name has to agree with
	// where the input actually comes from.
	for (const [name, datsInfo] of Object.entries(dats)) {
		const fromTosec = datsInfo.files.some((pattern) => pattern.startsWith('input/tosec/'))
		assert.strictEqual(name.includes('/tosec/'), fromTosec, `${name} and its input patterns disagree about being TOSEC`)
	}
})

test('no DAT is configured twice', function () {
	// JSON.parse keeps the last of a repeated key, so the raw text is the only
	// place a duplicate shows up.
	const raw = fs.readFileSync(path.join(__dirname, '..', 'dats.json'), 'utf8')
	const keys = [...raw.matchAll(/^\t"([^"]+)": \{$/gm)].map((match) => match[1])
	assert.strictEqual(keys.length, Object.keys(dats).length, 'dats.json has a repeated DAT name')
})

/**
 * The Redump system each of the given DATs builds from.
 */
function systemsIn(entries) {
	return new Set(entries
		.flatMap((datsInfo) => datsInfo.files)
		.filter((pattern) => pattern.startsWith('input/redump/'))
		.map((pattern) => pattern.split('/')[2]))
}

test('every Redump pattern names the system in the same place', function () {
	// redumpSystems() reads the system out of the third path segment, so a
	// pattern shaped any other way would silently download nothing.
	for (const [name, datsInfo] of Object.entries(dats)) {
		for (const pattern of datsInfo.files) {
			if (pattern.startsWith('input/redump/')) {
				assert.match(pattern, /^input\/redump\/[^/*?]+\//, `${name} builds from "${pattern}", which does not name a system`)
			}
		}
	}
})

test('the Redump systems to download are exactly the ones the DATs use', function () {
	const active = Object.values(dats).filter((datsInfo) => !datsInfo.disabled)
	// Nothing is fetched that no DAT reads, and nothing a DAT reads is missed.
	assert.deepStrictEqual(new Set(redumpSystems()), systemsIn(active))
	assert.ok(redumpSystems().length > 0)
})

test('leaves disabled DATs out of the Redump download', function () {
	const disabled = Object.values(dats).filter((datsInfo) => datsInfo.disabled)
	const active = Object.values(dats).filter((datsInfo) => !datsInfo.disabled)

	// A disabled DAT only keeps its system out of the download when no DAT
	// that is still on needs it too.
	for (const system of systemsIn(disabled)) {
		if (!systemsIn(active).has(system)) {
			assert.ok(!redumpSystems().includes(system), `${system} is only used by a disabled DAT, but is still downloaded`)
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
