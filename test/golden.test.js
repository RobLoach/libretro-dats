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
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'libretro-dats-golden-'))
	const out = path.join(tmp, 'metadat', metadat, 'Corpus')
	fs.mkdirSync(path.dirname(out), {recursive: true})

	// A corpus that needs files beside it, like Redump's cue sheets, gets a
	// directory of its own.
	const dir = path.join(__dirname, 'fixtures', corpus)
	const fixture = fs.existsSync(dir)
		? path.join(dir, `${corpus}.dat`)
		: path.join(__dirname, 'fixtures', `${corpus}.dat`)
	const result = await processDat({files: [fixture]}, out)

	// A new corpus has no expected output until UPDATE_GOLDEN writes it.
	const expected = path.join(__dirname, 'fixtures', `${corpus}.expected.dat`)
	return {
		result,
		output: fs.readFileSync(`${out}.dat`, 'utf8'),
		expected: fs.existsSync(expected) ? fs.readFileSync(expected, 'utf8') : ''
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

test('builds the Redump corpus exactly as expected', async function () {
	const {output, expected} = await build('redump-corpus', 'redump')
	assertMatchesExpected('redump-corpus', output, expected)
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
	assert.match(output, /\tname "Turrican \(Germany\)"\n\treleaseyear "1990"\n\tpublisher "Rainbow Arts"\n\tregion "Germany"/)
	assert.match(output, /\tname "Saboteur \(USA, Europe\)"/)
	assert.match(output, /\tname "Aventyr \(Sweden\)"/)
	// Plain English is dropped rather than named.
	assert.match(output, /\tname "Dizzy"/)
})

test('names alternate dumps for the game, without numbering them', async function () {
	const {output} = await build('tosec-corpus', 'tosec')
	assert.doesNotMatch(output, /\(Alt( \d+)?\)/)
	// Two formats of one game plus a "[a]" variant all go under its name.
	assert.strictEqual(output.match(/\tname "007 Multispy"/g).length, 3)
	// As does a "[cr][a]" beside the crack it is an alternate of.
	assert.strictEqual(output.match(/\tname "Jet Set Willy \[cr\]"/g).length, 2)
})

test('leaves No-Intro platform and dumper tags alone', async function () {
	const {output} = await build('no-intro-corpus', 'no-intro')
	// "(GB)" is Game Boy, not the United Kingdom, and the region comes from
	// "(Japan)" rather than from the platform tag.
	assert.match(output, /\tname "Kirby no Kirakira Kids \(Japan\) \(GB\) \(Virtual Console\)"\n\tregion "Japan"/)
	assert.match(output, /\tname "Donkey Kong \(USA\) \(GB\) \(Virtual Console\)"\n\tregion "USA"/)
	assert.match(output, /\tname "Space Mutants \(World\) \(v1\.03\) \(DK\) \(Retro Achievements\)"\n\tregion "World"\n\trom/)
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
	assert.doesNotMatch(tosec.output, /Chase HQ/)
	assert.doesNotMatch(tosec.output, /Head over Heels/)
	assert.doesNotMatch(tosec.output, /Test Program/)
	// No entry keeps a beta tag, whatever it was numbered or named.
	assert.doesNotMatch(tosec.output, /\(Beta\b/)
	assert.doesNotMatch(nointro.output, /\(Beta\b/)

	assert.doesNotMatch(nointro.output, /BIOS/)
	assert.doesNotMatch(nointro.output, /Starfox 2/)
	assert.doesNotMatch(nointro.output, /Adventures of Batman/)
	// Its serial conflicts with Sonic Adventure 2.
	assert.doesNotMatch(nointro.output, /Phantasy Star Online/)
	// Nothing but a .sav file to go on.
	assert.doesNotMatch(nointro.output, /Save Only/)
})

test('picks the data track a Redump cue sheet points at', async function () {
	const {output} = await build('redump-corpus', 'redump')
	// The only data track, rather than the larger audio after it.
	assert.match(output, /rom \( name "Wipeout \(USA\) \(Track 1\)\.bin"/)
	// The larger of two data tracks, the high-density area.
	assert.match(output, /rom \( name "Crazy Taxi \(USA\) \(En,Ja\) \(Track 3\)\.bin"/)
	// The first track of session 2, when every track is audio.
	assert.match(output, /rom \( name "Battle Morph \(USA\) \(Track 02\)\.bin"/)
	// Without a cue sheet, the first .bin.
	assert.match(output, /rom \( name "Ridge Racer \(USA\) \(Track 01\)\.bin"/)
})

test('writes the serials a Redump game is matched on', async function () {
	const {output} = await build('redump-corpus', 'redump')
	const serials = (title) => [...output.matchAll(/\tname "(.*)"\n(?:\t.*\n)*?\tserial "(.*)"/g)]
		.filter((match) => match[1] === title)
		.map((match) => match[2])

	// A disc gets its serial, and the serial suffixed with the disc's index.
	assert.deepStrictEqual(serials('Final Fantasy VII (USA) (Disc 1)'), ['SCUS-94163', 'SCUS-94163-0'])
	assert.deepStrictEqual(serials('Final Fantasy VII (USA) (Disc 2)'), ['SCUS-94163', 'SCUS-94163-1'])
	// Unless the serial carries the index already.
	assert.deepStrictEqual(serials('Resident Evil 4 (USA) (Disc 2)'), ['DL-DOL-G4BE-1-USA'])
	// Multiple serials become one game each, however they are separated.
	assert.deepStrictEqual(serials('0 kara no Mahjong - Mahjong Youchien Tamago-gumi (Japan)'), ['SLPS-01311', 'SLPS-02546'])
	assert.deepStrictEqual(serials("Championship Soccer '94 (USA) (En,Fr,De,It)"), ['T-93185', 'T-93115'])
})

// https://github.com/RobLoach/libretro-dats/issues/47
test('picks the ROM over the save data shipped beside it', async function () {
	const {output} = await build('no-intro-corpus', 'no-intro')
	assert.match(output, /\trom \( name "Kid Dracula \(World\) \(Castlevania Anniversary Collection\)\.nes" size 262144 crc 1000000F \)/)
	assert.doesNotMatch(output, /\.sav"/)
})

test('skips PlayStation license files but keeps the packages', async function () {
	const {output} = await build('no-intro-corpus', 'no-intro')
	assert.doesNotMatch(output, /work\.bin|\.rap"/)
	assert.doesNotMatch(output, /Killallzombies/)
	// The package is picked over the license beside it.
	assert.match(output, /\trom \( name "EP2696-PCSB00996_00-AIRRACESPEEDEURO\.pkg"/)
	assert.match(output, /\trom \( name "Azkend 2 - The World Beneath \(USA\) \(PSN\)\.vpk"/)
})

test('takes the serial of a PSN package from its content ID', async function () {
	const {output} = await build('no-intro-corpus', 'no-intro')
	assert.match(output, /\tname "Air Race Speed \(Europe\)"\n\tregion "Europe"\n\tserial "PCSB-00996"\n\trom \( name "EP2696-PCSB00996_00-AIRRACESPEEDEURO\.pkg" .* serial "PCSB-00996" \)/)
})

test('keeps the entries that only look like a beta', async function () {
	const tosec = await build('tosec-corpus', 'tosec')
	// Betasoft is a publisher, and gets dropped as one.
	assert.match(tosec.output, /\tname "Krakout"/)
	assert.match(tosec.output, /\tname "Beta Bloc \(Europe\)"/)

	const nointro = await build('no-intro-corpus', 'no-intro')
	assert.match(nointro.output, /\tname "Xbox Live Beta Starter Kit Disc \(USA, Europe\)"/)
	assert.match(nointro.output, /\tname "Halo 2 \(USA\) \(Multiplayer Beta\)"/)
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
