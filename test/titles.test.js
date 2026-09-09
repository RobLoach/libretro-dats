const test = require('node:test')
const assert = require('node:assert')
const {cleanGameName, normalizeCountries, normalizeLanguages, validEntry} = require('..')

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
	const clean = cleanGameName('Turrican (1990)(Rainbow Arts)(DE)', 'Test')
	assert.strictEqual(clean.title, 'Turrican (Germany)')
	assert.strictEqual(clean.releaseParams, '\n\treleaseyear "1990"')
})

test('drops unclear TOSEC dates, and their publisher', function () {
	assert.strictEqual(cleanGameName('Turrican (19xx)(Rainbow Arts)', 'Test').title, 'Turrican')
	assert.strictEqual(cleanGameName('Turrican (198x)(Rainbow Arts)', 'Test').title, 'Turrican')
})

test('removes the " of y" from a disc number', function () {
	assert.strictEqual(cleanGameName('Final Fantasy VII (USA) (Disc 1 of 3)', 'Test').title, 'Final Fantasy VII (USA) (Disc 1)')
	assert.strictEqual(cleanGameName('Some Game (Tape 2 of 2)', 'Test').title, 'Some Game (Tape 2)')
})

test('turns alt tags into alt names', function () {
	assert.strictEqual(cleanGameName('Some Game [a2]', 'Test').title, 'Some Game (Alt 2)')
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
