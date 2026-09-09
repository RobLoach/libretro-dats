const test = require('node:test')
const assert = require('node:assert')
const {cleanGameName, cleanSerial, collectGames, getGameEntry, grabDiscNumber, romFilename, sameEntry, validRom} = require('..')

/**
 * Build the entry a single ROM produces, the way processDat() does.
 */
function entryFor(rom, name = 'Test') {
	const games = collectGames([{[rom.crc]: rom}], name)
	const gameName = Object.keys(games)[0]
	return getGameEntry(gameName, games[gameName].clean, games[gameName].rom)
}

/**
 * Pull every game name out of a stretch of DAT output.
 */
function namesIn(output) {
	return [...output.matchAll(/^\tname "([^"]*)"$/gm)].map((match) => match[1])
}

test('writes out a game entry', function () {
	const output = entryFor({
		title: 'Some Game (USA)',
		name: 'Some Game (USA).iso',
		size: '100',
		crc: 'abcd1234',
		md5: 'deadbeef',
		sha1: 'c0ffee'
	})
	assert.strictEqual(output, `
game (
	name "Some Game (USA)"
	region "USA"
	rom ( name "Some Game (USA).iso" size 100 crc ABCD1234 md5 DEADBEEF sha1 C0FFEE )
)`)
})

test('leaves out hashes the source did not provide', function () {
	const output = entryFor({title: 'Some Game', name: 'Some Game.iso', crc: 'abcd1234'})
	assert.match(output, /rom \( name "Some Game\.iso" crc ABCD1234 \)/)
})

test('detects the region from a multi-region title', function () {
	assert.match(entryFor({title: 'Some Game (Japan, USA)', name: 'a.iso', crc: '1'}), /region "Japan"/)
	assert.match(entryFor({title: 'Some Game (Europe)', name: 'b.iso', crc: '2'}), /region "Europe"/)
})

test('detects the region from a TOSEC country code', function () {
	assert.match(entryFor({title: 'Some Game (1990)(Ocean)(DE)', name: 'c.iso', crc: '3'}), /region "Germany"/)
})

test('writes the release date alongside the region', function () {
	const output = entryFor({title: 'Some Game (1990)(Ocean)(DE)', name: 'd.iso', crc: '4'})
	assert.match(output, /\treleaseyear "1990"\n\tregion "Germany"\n/)
})

test('splits a multi-serial entry into one game per serial', function () {
	const output = entryFor({title: 'Some Game (Europe)', name: 'e.iso', crc: '5', serial: 'SLES-01234 / SLES-05678'})
	assert.deepStrictEqual(namesIn(output), ['Some Game (Europe)', 'Some Game (Europe)'])
	assert.match(output, /serial "SLES-01234"/)
	assert.match(output, /serial "SLES-05678"/)
})

test('writes a disc-suffixed serial alongside the plain one', function () {
	const output = entryFor({title: 'Some Game (USA) (Disc 2)', name: 'f.iso', crc: '6', serial: 'SLUS-00001'})
	assert.match(output, /serial "SLUS-00001"/)
	assert.match(output, /serial "SLUS-00001-1"/)
})

test('ignores placeholder serials', function () {
	const output = entryFor({title: 'Some Game', name: 'g.iso', crc: '7', serial: 'N/A'})
	assert.doesNotMatch(output, /serial/)
})

// https://github.com/RobLoach/libretro-dats/issues/3
test('gives colliding titles distinct names', function () {
	// Both titles clean up to "Cool Game", as the date and publisher are
	// stripped. They are different dumps, so both belong in the DAT, under
	// names that do not collide.
	const games = collectGames([{
		AAAAAAAA: {title: 'Cool Game (1991)(Ocean)', name: 'a.iso', crc: 'AAAAAAAA'},
		BBBBBBBB: {title: 'Cool Game (1993)(Ocean)', name: 'b.iso', crc: 'BBBBBBBB'}
	}], 'Test')

	assert.deepStrictEqual(Object.keys(games), ['Cool Game', 'Cool Game (Alt 1)'])

	const output = Object.keys(games).map((game) => getGameEntry(game, games[game].clean, games[game].rom)).join('')
	assert.deepStrictEqual(namesIn(output), ['Cool Game', 'Cool Game (Alt 1)'])
	// The dates still tell the two apart.
	assert.match(output, /releaseyear "1991"/)
	assert.match(output, /releaseyear "1993"/)
})

test('keeps counting up when more than two titles collide', function () {
	const games = collectGames([{
		A: {title: 'Cool Game (1991)', name: 'a.iso', crc: 'A'},
		B: {title: 'Cool Game (1992)', name: 'b.iso', crc: 'B'},
		C: {title: 'Cool Game (1993)', name: 'c.iso', crc: 'C'}
	}], 'Test')
	assert.deepStrictEqual(Object.keys(games), ['Cool Game', 'Cool Game (Alt 1)', 'Cool Game (Alt 2)'])
})

test('adds the same dump only once', function () {
	// The same game turning up in two of the DAT's source files.
	const rom = {title: 'Cool Game (1991)', name: 'a.iso', crc: 'AAAAAAAA'}
	const games = collectGames([{AAAAAAAA: rom}, {AAAAAAAA: {...rom}}], 'Test')
	assert.deepStrictEqual(Object.keys(games), ['Cool Game'])
})

test('leaves out invalid entries and .sav files', function () {
	const games = collectGames([{
		A: {title: 'Cool Game [BIOS]', name: 'a.iso', crc: 'A'},
		B: {title: 'Cool Game', name: 'b.sav', crc: 'B'},
		C: {title: 'Cool Game', name: 'c.iso', crc: 'C'}
	}], 'Test')
	assert.deepStrictEqual(Object.keys(games), ['Cool Game'])
})

test('recognizes the same entry by crc or serial', function () {
	assert.strictEqual(sameEntry({crc: 'A'}, {crc: 'A'}), true)
	assert.strictEqual(sameEntry({crc: 'A'}, {crc: 'B'}), false)
	assert.strictEqual(sameEntry({serial: 'SLUS-1'}, {serial: 'SLUS-1'}), true)
	assert.strictEqual(sameEntry({}, {}), false)
})

test('cleans up serials', function () {
	assert.strictEqual(cleanSerial(' SLUS 00001 '), 'SLUS-00001')
	assert.strictEqual(cleanSerial('#SLUS-00001'), 'SLUS-00001')
	assert.strictEqual(cleanSerial('-SLUS-00001'), 'SLUS-00001')
	assert.strictEqual(cleanSerial(''), '')
})

test('grabs the disc number', function () {
	assert.strictEqual(grabDiscNumber('Some Game (Disc 2)'), 2)
	assert.strictEqual(grabDiscNumber('Some Game (Disk 3)'), 3)
	assert.strictEqual(grabDiscNumber('Some Game'), false)
})

test('sanitizes the rom filename', function () {
	assert.strictEqual(romFilename({name: 'sub/dir/Pokémon.iso'}), 'Pokemon.iso')
})

test('rejects .sav roms', function () {
	assert.strictEqual(validRom({name: 'Some Game.sav'}), false)
	assert.strictEqual(validRom({name: 'Some Game.iso'}), true)
})

test('cleanGameName is what collectGames keys on', function () {
	const games = collectGames([{A: {title: 'Some Game (1990)(Ocean)', name: 'a.iso', crc: 'A'}}], 'Test')
	assert.deepStrictEqual(Object.keys(games), [cleanGameName('Some Game (1990)(Ocean)', 'Test').title])
})
