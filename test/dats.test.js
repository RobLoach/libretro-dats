const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {cueDataTracks, gdiDataTracks, getGamesFromXml, getHeader, processDat, reportRun} = require('..')

/**
 * Run reportRun(), and hand back everything it logged.
 */
function report(written, missing, empty) {
	const lines = []
	const log = console.log
	console.log = (line) => lines.push(line)
	try {
		reportRun(written, missing, empty)
	} finally {
		console.log = log
	}
	return lines.join('\n')
}

/**
 * Write the given files into a fresh temporary directory.
 */
function fixture(files) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libretro-dats-'))
	for (const [name, contents] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, name)), {recursive: true})
		fs.writeFileSync(path.join(dir, name), contents)
	}
	return dir
}

function datFile(games) {
	return `<?xml version="1.0"?>\n<datafile>\n<header><name>Test</name></header>\n${games}\n</datafile>\n`
}

function game(title, roms) {
	return `<game name="${title}"><description>${title}</description>${roms}</game>`
}

test('writes a header', function () {
	const header = getHeader('database/metadat/redump/Sony - PlayStation', {homepage: 'http://example.com'})
	assert.match(header, /^clrmamepro \(\n\tname "Sony - PlayStation"\n/)
	assert.match(header, /\tdescription "Sony - PlayStation"\n/)
	assert.match(header, /\tversion "\d{4}\.\d{2}\.\d{2}"\n/)
	assert.match(header, /\thomepage "http:\/\/example\.com"\n\)\n$/)
})

test('builds a DAT file', async function () {
	const dir = fixture({
		'input/Test.dat': datFile(game('Some Game (USA)', '<rom name="Some Game (USA).iso" size="100" crc="abcd1234"/>'))
	})
	const result = await processDat({files: [path.join(dir, 'input/*.dat')]}, path.join(dir, 'out'))

	assert.deepStrictEqual(result, {files: 1, games: 1})
	const output = fs.readFileSync(path.join(dir, 'out.dat'), 'utf8')
	assert.match(output, /^clrmamepro \(/)
	assert.match(output, /\tname "Some Game \(USA\)"\n\tregion "USA"\n/)
	assert.match(output, /rom \( name "Some Game \(USA\)\.iso" size 100 crc ABCD1234 \)/)
})

test('reports when a DAT has no input files', async function () {
	const dir = fixture({})
	const result = await processDat({files: [path.join(dir, 'nothing/*.dat')]}, path.join(dir, 'out'))

	assert.deepStrictEqual(result, {files: 0, games: 0})
	assert.strictEqual(fs.existsSync(path.join(dir, 'out.dat')), false)
})

test('reports when a DAT has input files but no valid games', async function () {
	const dir = fixture({
		'input/Test.dat': datFile(game('Some Game [BIOS]', '<rom name="Some Game.iso" size="100" crc="abcd1234"/>'))
	})
	const result = await processDat({files: [path.join(dir, 'input/*.dat')]}, path.join(dir, 'out'))

	assert.deepStrictEqual(result, {files: 1, games: 0})
	assert.strictEqual(fs.existsSync(path.join(dir, 'out.dat')), false)
})

test('reports when a DAT is configured with no file patterns at all', async function () {
	const dir = fixture({})
	assert.deepStrictEqual(await processDat({}, path.join(dir, 'out')), {files: 0, games: 0})
})

test('sorts the games it writes out', async function () {
	const dir = fixture({
		'input/Test.dat': datFile([
			game('Zebra Game', '<rom name="z.iso" size="1" crc="0000000C"/>'),
			game('Alpha Game', '<rom name="a.iso" size="1" crc="0000000A"/>'),
			game('Middle Game', '<rom name="m.iso" size="1" crc="0000000B"/>')
		].join('\n'))
	})
	await processDat({files: [path.join(dir, 'input/*.dat')]}, path.join(dir, 'out'))

	// Skip the header, which carries a name of its own.
	const output = fs.readFileSync(path.join(dir, 'out.dat'), 'utf8').split('\ngame (').slice(1).join('\ngame (')
	const names = [...output.matchAll(/^\tname "([^"]*)"$/gm)].map((match) => match[1])
	assert.deepStrictEqual(names, ['Alpha Game', 'Middle Game', 'Zebra Game'])
})

test('picks the largest data track listed in a cue sheet', function () {
	const dir = fixture({
		'Some Game (USA).cue': [
			'FILE "Some Game (USA) (Track 01).bin" BINARY',
			'  TRACK 01 MODE2/2352',
			'FILE "Some Game (USA) (Track 02).bin" BINARY',
			'  TRACK 02 AUDIO'
		].join('\n')
	})
	const dat = {
		datafile: {
			header: [{name: ['Test']}],
			game: [{
				'$': {name: 'Some Game (USA)'},
				description: ['Some Game (USA)'],
				rom: [
					{'$': {name: 'Some Game (USA).cue', size: '10', crc: '1'}},
					{'$': {name: 'Some Game (USA) (Track 01).bin', size: '900', crc: '2'}},
					{'$': {name: 'Some Game (USA) (Track 02).bin', size: '100', crc: '3'}}
				]
			}]
		}
	}

	const games = getGamesFromXml(path.join(dir, 'Some Game (USA).dat'), dat)
	// Track 02 is audio, so the data track is the one that gets used.
	assert.deepStrictEqual(Object.keys(games), ['2'])
	assert.strictEqual(games['2'].name, 'Some Game (USA) (Track 01).bin')
	assert.strictEqual(games['2'].title, 'Some Game (USA)')
})

test('summarizes a run', function () {
	const output = report(2, ['Sega - Saturn'], ['Sony - PlayStation'])
	assert.match(output, /Built 2 of 4 DATs\./)
	assert.match(output, /No input files found for 1 DATs:\n\tSega - Saturn/)
	assert.match(output, /No valid games found for 1 DATs:\n\tSony - PlayStation/)
})

test('says nothing more when every DAT was built', function () {
	const output = report(3, [], [])
	assert.match(output, /Built 3 of 3 DATs\./)
	assert.doesNotMatch(output, /No input files found/)
	assert.doesNotMatch(output, /No valid games found/)
})

test('fails the run when nothing at all was built', function () {
	assert.throws(() => report(0, ['Sega - Saturn'], []), /No DATs were built/)
})

test('finds the data tracks in a cue sheet', function () {
	const dir = fixture({
		'game.cue': [
			'FILE "game (Track 1).bin" BINARY',
			'  TRACK 01 MODE1/2352',
			'    INDEX 01 00:00:00',
			'FILE "game (Track 2).bin" BINARY',
			'  TRACK 02 AUDIO',
			'    INDEX 01 00:00:00',
			'FILE "game (Track 3).bin" BINARY',
			'  TRACK 03 MODE1/2352'
		].join('\n')
	})
	assert.deepStrictEqual(cueDataTracks(path.join(dir, 'game.cue')), ['game (Track 1).bin', 'game (Track 3).bin'])
})

test('returns no cue tracks when the cue sheet is missing', function () {
	assert.deepStrictEqual(cueDataTracks('/nope/missing.cue'), [])
})

test('finds the data tracks in a gdi file', function () {
	const dir = fixture({
		'game.gdi': [
			'3',
			'1 0 4 2352 "track01.bin" 0',
			'2 600 0 2352 "track02.raw" 0',
			'3 45000 4 2048 "track03.bin" 0'
		].join('\n')
	})
	// Track 2 is the audio track, at type 0 and a 2352 sector size.
	assert.deepStrictEqual(gdiDataTracks(path.join(dir, 'game.gdi')), ['track01.bin', 'track03.bin'])
})

test('returns no gdi tracks when the gdi file is missing', function () {
	assert.deepStrictEqual(gdiDataTracks('/nope/missing.gdi'), [])
})
