const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {processDat, withoutVersion} = require('..')

/**
 * Build one of the fixture corpora, and hand back what came out.
 *
 * The corpora hold real titles from the three sources, and their expected
 * output is checked in beside them. Asserting on whole DATs rather than on
 * single titles is what catches a title rule that is subtly wrong across the
 * board: a regex that looked right against hand-written cases once kept three
 * thousand TOSEC publisher abbreviations in the titles, and every unit test
 * still passed.
 *
 * The DAT name decides how titles are read, so the fixtures are built under a
 * path that matches where they would really be written.
 */
async function build(corpus, metadat) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libretro-dats-golden-'))
	const out = path.join(dir, 'metadat', metadat, 'Corpus')
	fs.mkdirSync(path.dirname(out), {recursive: true})

	const fixture = path.join(__dirname, 'fixtures', `${corpus}.dat`)
	const result = await processDat({files: [fixture]}, out)

	return {
		result,
		output: fs.readFileSync(`${out}.dat`, 'utf8'),
		expected: fs.readFileSync(path.join(__dirname, 'fixtures', `${corpus}.expected.dat`), 'utf8')
	}
}

/**
 * Compare a built DAT against its expected output, less the version line,
 * which carries the date the DAT was built.
 *
 * Running with UPDATE_GOLDEN set rewrites the expected files instead, for when
 * a change is meant to alter the output. Review the diff that leaves behind.
 */
function assertMatchesExpected(corpus, output, expected) {
	if (process.env.UPDATE_GOLDEN) {
		fs.writeFileSync(path.join(__dirname, 'fixtures', `${corpus}.expected.dat`), output)
		return
	}
	assert.strictEqual(withoutVersion(output), withoutVersion(expected))
}

test('builds the TOSEC corpus exactly as expected', async function () {
	const {output, expected} = await build('tosec-corpus', 'tosec')
	assertMatchesExpected('tosec-corpus', output, expected)
})

test('builds the No-Intro corpus exactly as expected', async function () {
	const {output, expected} = await build('no-intro-corpus', 'no-intro')
	assertMatchesExpected('no-intro-corpus', output, expected)
})

test('stamps the version with the date the DAT was built', async function () {
	const {output} = await build('tosec-corpus', 'tosec')
	assert.match(output, /\tversion "\d{4}\.\d{2}\.\d{2}"\n/)
})

// The checks below name what the corpora are actually guarding, so a failure
// above points at the rule that broke rather than just a line number.

test('drops the TOSEC publisher but keeps a flag in the same slot', async function () {
	const {output} = await build('tosec-corpus', 'tosec')
	// "(CP)", "(NT)", "(EA)" and "(vtrdos.ru)" are publishers.
	assert.match(output, /\tname "16K Superchess \(16K\)"/)
	assert.match(output, /\tname "Rockman 8 \(Taiwan\)"/)
	assert.match(output, /\tname "Shadow of the Beast"/)
	assert.match(output, /\tname "Elite"/)
	// A flag there is kept.
	assert.match(output, /\tname "Boulder Dash \(Rev 1\)"/)
	assert.match(output, /\tname "Lords of Midnight \(Disk 1\)"/)
	assert.match(output, /\tname "Alien Games \(Proto\)"/)
})

test('translates TOSEC country and language codes', async function () {
	const {output} = await build('tosec-corpus', 'tosec')
	assert.match(output, /\tname "Turrican \(Germany\)"\n\treleaseyear "1990"\n\tregion "Germany"/)
	assert.match(output, /\tname "Saboteur \(USA, Europe\)"/)
	assert.match(output, /\tname "Aventyr \(Sweden\)"/)
	// Plain English is dropped rather than named.
	assert.match(output, /\tname "Dizzy"/)
})

test('numbers alts in one series, however they got there', async function () {
	const {output} = await build('tosec-corpus', 'tosec')
	// Two formats of one game plus a "[a]" variant, which used to collide into
	// "007 Multispy (Alt 1) (Alt 1)".
	assert.match(output, /\tname "007 Multispy"/)
	assert.match(output, /\tname "007 Multispy \(Alt 1\)"/)
	assert.match(output, /\tname "007 Multispy \(Alt 2\)"/)
	assert.doesNotMatch(output, /\(Alt \d+\) \(Alt \d+\)/)
	// "[cr][a]" leaves the alt tag stuck to the flag in front of it.
	assert.match(output, /\tname "Jet Set Willy \[cr\]"/)
	assert.match(output, /\tname "Jet Set Willy \[cr\] \(Alt 1\)"/)
})

test('leaves No-Intro platform and dumper tags alone', async function () {
	const {output} = await build('no-intro-corpus', 'no-intro')
	// "(GB)" is Game Boy, not the United Kingdom, and the region comes from
	// "(Japan)" rather than from the platform tag.
	assert.match(output, /\tname "Kirby no Kirakira Kids \(Japan\) \(GB\) \(Virtual Console\)"\n\tregion "Japan"/)
	assert.match(output, /\tname "Donkey Kong \(USA\) \(GB\) \(Virtual Console\)"\n\tregion "USA"/)
	assert.match(output, /\tname "Space Mutants \(World\) \(v1\.03\) \(DK\) \(Retro Achievements\)"\n\trom/)
	assert.match(output, /\tname "Half Life 2 - The Orange Box \(Europe\) \(v3\) \(LV\)"/)
	assert.match(output, /\tname "2020 Super Baseball \(Europe\) \(NG\) \(Virtual Console\)"/)
	// Regions No-Intro writes out in full still resolve.
	assert.match(output, /\tname "Bamse \(Sweden\)"\n\tregion "Sweden"/)
})

test('leaves out entries that do not belong in a DAT', async function () {
	const tosec = await build('tosec-corpus', 'tosec')
	const nointro = await build('no-intro-corpus', 'no-intro')

	// TOSEC writes "(beta)" lowercase, which only looks invalid once cleaned.
	assert.doesNotMatch(tosec.output, /Target Renegade/)
	assert.doesNotMatch(tosec.output, /Beta/)
	assert.doesNotMatch(tosec.output, /Test Program/)

	assert.doesNotMatch(nointro.output, /BIOS/)
	assert.doesNotMatch(nointro.output, /Starfox 2/)
	// Its serial conflicts with Sonic Adventure 2.
	assert.doesNotMatch(nointro.output, /Phantasy Star Online/)
	// Nothing but a .sav file to go on. https://github.com/RobLoach/libretro-dats/issues/47
	assert.doesNotMatch(nointro.output, /Kid Dracula/)
})

test('writes nothing when the output has not changed', async function () {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libretro-dats-golden-'))
	const out = path.join(dir, 'metadat', 'tosec', 'Corpus')
	fs.mkdirSync(path.dirname(out), {recursive: true})
	const fixture = path.join(__dirname, 'fixtures', 'tosec-corpus.dat')

	const first = await processDat({files: [fixture]}, out)
	assert.strictEqual(first.changed, true)

	// The version line would otherwise rewrite every DAT on every run.
	const written = fs.statSync(`${out}.dat`).mtimeMs
	const second = await processDat({files: [fixture]}, out)
	assert.strictEqual(second.changed, false)
	assert.strictEqual(fs.statSync(`${out}.dat`).mtimeMs, written)
})

test('rewrites a DAT whose version line is the only thing out of date', async function () {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libretro-dats-golden-'))
	const out = path.join(dir, 'metadat', 'tosec', 'Corpus')
	fs.mkdirSync(path.dirname(out), {recursive: true})
	const fixture = path.join(__dirname, 'fixtures', 'tosec-corpus.dat')

	await processDat({files: [fixture]}, out)
	const stale = fs.readFileSync(`${out}.dat`, 'utf8').replace(/\tversion ".*"\n/, '\tversion "1999.01.01"\n')
	fs.writeFileSync(`${out}.dat`, stale)

	// Only the version differs, so the DAT is left as it is.
	assert.strictEqual((await processDat({files: [fixture]}, out)).changed, false)
	assert.match(fs.readFileSync(`${out}.dat`, 'utf8'), /\tversion "1999\.01\.01"/)
})
