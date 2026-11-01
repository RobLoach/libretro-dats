const test = require('node:test')
const assert = require('node:assert')
const {cleanGameName, isTosec, keepDatFlag, normalizeCountries, normalizeLanguages, validEntry} = require('..')

// A DAT name that marks the source as TOSEC, which is the only one whose
// titles carry two-letter country and language codes.
const TOSEC = 'database/metadat/tosec/Test'

test('leaves a No-Intro style title alone', function () {
	assert.strictEqual(cleanGameName('Super Mario World (USA)', 'Test').title, 'Super Mario World (USA)')
})

test('pulls the release date out of the title', function () {
	const clean = cleanGameName('Turrican (1990)', 'Test')
	assert.strictEqual(clean.title, 'Turrican')
	assert.strictEqual(clean.releaseParams, '\n\treleaseyear "1990"')
})

test('pulls a full release date out of the title', function () {
	const clean = cleanGameName('Turrican (1990-06-12)', 'Test')
	assert.strictEqual(clean.title, 'Turrican')
	assert.strictEqual(clean.releaseParams, '\n\treleaseyear "1990"\n\treleasemonth "06"\n\treleaseday "12"')
})

test('ignores an out of range release date', function () {
	const clean = cleanGameName('Turrican (1492)', 'Test')
	assert.strictEqual(clean.title, 'Turrican (1492)')
	assert.strictEqual(clean.releaseParams, '')
})

test('drops the publisher that follows a TOSEC date', function () {
	const clean = cleanGameName('Turrican (1990)(Rainbow Arts)(DE)', TOSEC)
	assert.strictEqual(clean.title, 'Turrican (Germany)')
	assert.strictEqual(clean.releaseParams, '\n\treleaseyear "1990"')
})

test('drops unclear TOSEC dates, and their publisher', function () {
	assert.strictEqual(cleanGameName('Turrican (19xx)(Rainbow Arts)', TOSEC).title, 'Turrican')
	assert.strictEqual(cleanGameName('Turrican (198x)(Rainbow Arts)', TOSEC).title, 'Turrican')
})

test('keeps a flag that sits where a TOSEC publisher would', function () {
	// The publisher is dropped along with the date, but a flag in the same
	// spot is real information: without it both revisions collapse into
	// "Boulder Dash", with nothing left to tell them apart.
	assert.strictEqual(cleanGameName('Boulder Dash (1984)(Rev 1)', TOSEC).title, 'Boulder Dash (Rev 1)')
	assert.strictEqual(cleanGameName('Boulder Dash (1984)(Rev 2)', TOSEC).title, 'Boulder Dash (Rev 2)')
	assert.strictEqual(cleanGameName('Some Game (1984)(Proto)', TOSEC).title, 'Some Game (Proto)')
	assert.strictEqual(cleanGameName('Some Game (1984)(Disk 1 of 2)', TOSEC).title, 'Some Game (Disk 1)')
})

test('still drops a two-letter publisher that follows a TOSEC date', function () {
	// The slot after the date is TOSEC's positional publisher field, so a short
	// code there is an abbreviated publisher, not a country: "(CP)" is Czech
	// Paradise and "(EA)" is Electronic Arts.
	assert.strictEqual(cleanGameName('16K Superchess (1983)(CP)(16K)', TOSEC).title, '16K Superchess (16K)')
	assert.strictEqual(cleanGameName('Rockman 8 (19xx)(NT)(TW)', TOSEC).title, 'Rockman 8 (Taiwan)')
	assert.strictEqual(cleanGameName('Some Game (1990)(EA)', TOSEC).title, 'Some Game')
})

test('keeps a flag that sits where a publisher would after an unclear date', function () {
	assert.strictEqual(cleanGameName('Some Game (198x)(Rev 2)', TOSEC).title, 'Some Game (Rev 2)')
})

// https://github.com/RobLoach/libretro-dats/issues/27
test('only translates two-letter codes for TOSEC', function () {
	// No-Intro puts platform and dumper tags where TOSEC puts country codes,
	// so "(GB)" is Game Boy on a Virtual Console entry, not the United Kingdom.
	const nointro = 'database/metadat/no-intro/Nintendo - Nintendo 3DS (Digital)'
	assert.strictEqual(cleanGameName('Donkey Kong (USA) (GB) (Virtual Console)', nointro).title, 'Donkey Kong (USA) (GB) (Virtual Console)')
	assert.strictEqual(cleanGameName('Space Mutants (World) (DK)', nointro).title, 'Space Mutants (World) (DK)')
	// The same codes in a TOSEC title really are countries.
	assert.strictEqual(cleanGameName('Some Game (GB)', TOSEC).title, 'Some Game (United Kingdom)')
})

test('tells a TOSEC publisher apart from a flag', function () {
	assert.strictEqual(keepDatFlag('(Rev 1)'), '(Rev 1)')
	assert.strictEqual(keepDatFlag('(Disc 2 of 3)'), '(Disc 2 of 3)')
	// Anything else in that spot is the publisher, which gets dropped. Short
	// codes especially: they are abbreviated publishers, not country codes.
	assert.strictEqual(keepDatFlag('(Rainbow Arts)'), '')
	assert.strictEqual(keepDatFlag('(Ocean)'), '')
	assert.strictEqual(keepDatFlag('(EU-US)'), '')
	assert.strictEqual(keepDatFlag('(en-ja)'), '')
	assert.strictEqual(keepDatFlag('(CP)'), '')
	assert.strictEqual(keepDatFlag('(vtrdos.ru)'), '')
	assert.strictEqual(keepDatFlag(undefined), '')
})

test('recognizes which DATs come from TOSEC', function () {
	assert.strictEqual(isTosec('database/metadat/tosec/Sega - Saturn'), true)
	assert.strictEqual(isTosec('database/metadat/no-intro/Sega - Saturn'), false)
	assert.strictEqual(isTosec('database/metadat/redump/Sega - Saturn'), false)
})

test('removes the " of y" from a disc number', function () {
	assert.strictEqual(cleanGameName('Final Fantasy VII (USA) (Disc 1 of 3)', 'Test').title, 'Final Fantasy VII (USA) (Disc 1)')
	assert.strictEqual(cleanGameName('Some Game (Tape 2 of 2)', 'Test').title, 'Some Game (Tape 2)')
})

test('names an alternate dump for the game itself', function () {
	assert.strictEqual(cleanGameName('Some Game [a2]', 'Test').title, 'Some Game')
	assert.strictEqual(cleanGameName('Some Game [cr][a]', 'Test').title, 'Some Game [cr]')
	assert.strictEqual(cleanGameName('Some Game [a29]', 'Test').title, 'Some Game')
	assert.strictEqual(cleanGameName('Some Game [a no cracktro]', 'Test').title, 'Some Game [a no cracktro]')
	assert.strictEqual(cleanGameName('Some Game (Alt 1) (Disk 2)', 'Test').title, 'Some Game (Disk 2)')
	assert.strictEqual(cleanGameName('Some Game (1984)(Alt 1)', TOSEC).title, 'Some Game')
	assert.strictEqual(cleanGameName('Some Game (19xx)(Alt)', TOSEC).title, 'Some Game')
	// Only the tag goes, not a title that happens to start the same way.
	assert.strictEqual(cleanGameName('Death Mask (Alternative Software)', 'Test').title, 'Death Mask (Alternative Software)')
})

test('collapses repeated whitespace and duplicated parentheses', function () {
	assert.strictEqual(cleanGameName('Some  Game (USA) (USA)', 'Test').title, 'Some Game (USA)')
})

test('strips the numeric prefix from Game Boy Advance and Nintendo DS titles', function () {
	const name = 'database/metadat/no-intro/Nintendo - Game Boy Advance'
	assert.strictEqual(cleanGameName('0123 - Some Game (USA)', name).title, 'Some Game (USA)')
	// Other systems keep the prefix, as they are part of the real title.
	assert.strictEqual(cleanGameName('0123 - Some Game (USA)', 'Test').title, '0123 - Some Game (USA)')
})

test('replaces unicode characters', function () {
	assert.strictEqual(cleanGameName('Pokémon Ruby (USA)', 'Test').title, 'Pokemon Ruby (USA)')
})

test('keeps the original title around for region detection', function () {
	assert.strictEqual(cleanGameName('Turrican (1990)', 'Test').raw, 'Turrican (1990)')
})

test('normalizes TOSEC country codes', function () {
	assert.strictEqual(normalizeCountries('Some Game (JP)'), 'Some Game (Japan)')
	assert.strictEqual(normalizeCountries('Some Game (EU-US)'), 'Some Game (USA, Europe)')
	// Japan, USA and Europe come first, the rest sort alphabetically.
	assert.strictEqual(normalizeCountries('Some Game (DE-JP-US)'), 'Some Game (Japan, USA, Germany)')
	// Unknown codes are left alone.
	assert.strictEqual(normalizeCountries('Some Game (ZZ)'), 'Some Game (ZZ)')
	assert.strictEqual(normalizeCountries('Some Game (US-ZZ)'), 'Some Game (US-ZZ)')
})

test('normalizes TOSEC language codes', function () {
	// Plain English is dropped, the way No-Intro does it.
	assert.strictEqual(normalizeLanguages('Some Game (en)'), 'Some Game ')
	assert.strictEqual(normalizeLanguages('Some Game (de)'), 'Some Game (Germany)')
	assert.strictEqual(normalizeLanguages('Some Game (en-ja)'), 'Some Game (En,Ja)')
	// Unknown codes are left alone.
	assert.strictEqual(normalizeLanguages('Some Game (zz)'), 'Some Game (zz)')
})

test('invalidates entries that do not belong in a DAT', function () {
	assert.strictEqual(validEntry('Some Game (USA)'), true)
	assert.strictEqual(validEntry('Some Game [BIOS]'), false)
	assert.strictEqual(validEntry('Some Game [b]'), false)
	assert.strictEqual(validEntry('Some Game (Demo)'), false)
	assert.strictEqual(validEntry('Super Nintendo Tester'), false)
	// Its serial conflicts with Sonic Adventure 2.
	assert.strictEqual(validEntry('Phantasy Star Online (USA) (Rev B)'), false)
	assert.strictEqual(validEntry('Phantasy Star Online (USA)'), true)
})

test('invalidates a beta however it is numbered or named', function () {
	assert.strictEqual(validEntry('Some Game (Beta)'), false)
	assert.strictEqual(validEntry('Some Game (Beta 1)'), false)
	assert.strictEqual(validEntry('Some Game (Beta 12)'), false)
	assert.strictEqual(validEntry('Some Game (Beta 32)'), false)
	assert.strictEqual(validEntry('Some Game (Beta Demo)'), false)
	assert.strictEqual(validEntry('Some Game (Beta Phase 2)'), false)
	assert.strictEqual(validEntry('Some Game (USA) (Beta 4)'), false)
})

test('keeps entries that only look like a beta', function () {
	// Betasoft published for the ZX Spectrum, and these are all real titles.
	assert.strictEqual(validEntry('Krakout (1987)(Betasoft)'), true)
	assert.strictEqual(validEntry('Beta Bloc (Europe)'), true)
	assert.strictEqual(validEntry('Xbox Live Beta Starter Kit Disc (USA, Europe)'), true)
	assert.strictEqual(validEntry('PS2 Linux Beta Release 1 (Japan) (En,Ja)'), true)
	assert.strictEqual(validEntry('Halo 2 (USA) (Multiplayer Beta)'), true)
	assert.strictEqual(validEntry('Soul Blazer (USA) [T-En by SteppoBlazer Beta] [i]'), true)
})
