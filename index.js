const fs = require('fs')
const path = require('path')
const {parseArgs} = require('util')
const pkg = require('./package')
const xml = require('xml2js').Parser()
// sort-keys is ESM only, so require() hands back the module rather than the
// function itself.
const sort = require('sort-keys').default
const unidecode = require('unidecode')
const sanitizeFilename = require('sanitize-filename')
const dats = require('./dats.json')
const countries = require('./countries.json')
const download = require('./download')

/**
 * The command line options the build accepts.
 */
function getOptions(argv) {
	const {values} = parseArgs({
		args: argv,
		options: {
			// Build from the input files already on disk, without fetching any.
			'skip-download': {type: 'boolean', default: false},
			// Fetch the sources again, rather than reusing what was downloaded
			// on an earlier run.
			'force-download': {type: 'boolean', default: false}
		}
	})
	// parseArgs hands back a null-prototype object, which is awkward to work
	// with everywhere else.
	return {...values}
}

async function start(argv = process.argv.slice(2)) {
	const options = getOptions(argv)
	if (options['skip-download']) {
		console.log('Skipping the download, building from the input files on disk.')
	}
	else {
		await download({force: options['force-download']})
	}

	const missing = []
	const empty = []
	const failed = []
	const disabled = []
	let written = 0
	for (const [name, datsInfo] of Object.entries(dats)) {
		let result
		try {
			result = await processDat(datsInfo, name)
		}
		catch (err) {
			// A single unreadable or malformed source should not take the other
			// DATs down with it, so the failure is recorded and the build
			// carries on. The run still ends in a non-zero exit code.
			console.error(`FAILED ${name}: ${err.message}`)
			failed.push(name)
			continue
		}

		if (result.disabled) {
			disabled.push(name)
		}
		else if (result.files === 0) {
			missing.push(name)
		}
		else if (result.games === 0) {
			empty.push(name)
		}
		else {
			written++
		}
	}

	reportRun(written, missing, empty, failed, disabled)
	if (failed.length > 0) {
		process.exitCode = 1
	}
}

/**
 * Summarize the run. Individual DATs are skipped quietly amongst thousands of
 * lines of output, so a build with missing input otherwise looks just like a
 * successful one.
 */
function reportRun(written, missing, empty, failed = [], disabled = []) {
	const total = written + missing.length + empty.length + failed.length
	console.log(`\nBuilt ${written} of ${total} DATs.`)

	// Disabled DATs are turned off on purpose, so they are listed last, apart
	// from the ones that were meant to build and did not.
	const lists = [
		['Failed to build', failed],
		['No input files found for', missing],
		['No valid games found for', empty],
		['Skipped', disabled, 'disabled DATs']
	]
	for (const [label, names, noun = 'DATs'] of lists) {
		if (names.length > 0) {
			console.log(`\n${label} ${names.length} ${noun}:`)
			for (const name of names) {
				console.log(`\t${name}`)
			}
		}
	}

	// Nothing at all was built, so the input directory is missing rather than
	// any individual source being unavailable.
	if (written === 0) {
		throw new Error(failed.length > 0
			? `No DATs were built, and ${failed.length} failed to build. Check the errors above.`
			: 'No DATs were built. Are the input files in place?')
	}
}

if (require.main === module) {
	start().catch(function (err) {
		console.error(err)
		process.exitCode = 1
	})
}

/**
 * Substrings that invalidate a game entry entirely.
 */
const invalidSubstrings = [
	'[BIOS]',
	'[b]',
	'(Test Program)',
	' (Demo)',
	' (demo)',
	' (demo-',
	'(Program)',
	'- Program -',
	' (Beta)',
	' (Beta 1)',
	' (Beta 2)',
	' (Beta 3)',
	'Test Cartridge',
	'Super Nintendo Tester',
	'Version Data',
	'(System)',
	'G. Darius (USA) (Beta)'
]

/**
 * Title replacements, applied in order. An empty string removes the match.
 */
const titleReplacements = [
	['Games (Europe)\\', ''],
	['Games\\', ''],
	['Games (USA)\\', ''],
	['Games (Japan)\\', ''],
	['Games (cdi)\\', ''],
	['Games (elf)\\', ''],
	['MISSING\\', ''],
	['Samplers\\', ''],
	['Multimedia\\', ''],
	['(Sony Imagesoft)', ''],
	['(Sony)', ''],
	['(Sega)', ''],
	['(Riot)', ''],
	['(Bignet - Micronet)', ''],
	['(Bignet)', ''],
	['(Acclaim - Domark)', ''],
	['(Acclaim)', ''],
	['(Gametek)', ''],
	['(Good Deal Games)', ''],
	['(Good Deal Games - Stargate Films)', ''],
	['(Sega - Tec Toy)', ''],
	['(SIMS)', ''],
	['(Sims)', ''],
	['(Tecmo)', ''],
	['(Sensible Software - Sony)', ''],
	['(Taito)', ''],
	['(Infogrames)', ''],
	['(Interplay)', ''],
	['(Domark)', ''],
	['(Pony Canyon)', ''],
	['(Panasonic)', ''],
	['(LG)', ''],
	['(Yoshimoto Kogyo)', ''],
	['(Studio 3DO)', ''],
	['(GoldStar)', ''],
	['(Human)', ''],
	['(Bandai)', ''],
	['(Activision)', ''],
	['(Infomedia)', ''],
	['(RE)', ''],
	['(Data East - Sega)', ''],
	['(ReadySoft)', ''],
	['(Virgin)', ''],
	['[a]', '(Alt 1)'],
	['[a1]', '(Alt 1)'],
	['[a2]', '(Alt 2)'],
	['[a3]', '(Alt 3)'],
	['[a4]', '(Alt 4)'],
	['[a5]', '(Alt 5)'],
	['[a6]', '(Alt 6)'],
	['[a7]', '(Alt 7)'],
	['[a8]', '(Alt 8)'],
	['[a9]', '(Alt 9)'],
	['[a10]', '(Alt 10)'],
	['[a11]', '(Alt 11)'],
	['(EA Sports)', ''],
	['(Electronic Arts)', ''],
	['(Digital Pictures)', ''],
	['(Good Deal Games - Oldergames)', ''],
	['(Victor)', ''],
	['(JVC)', ''],
	['(Wolf Team)', ''],
	['(Polydor K.K.)', ''],
	['(NTSC)', ''],
	[' (Mega Power)', ''],
	[' (SMW Hack)', ''],
	['Games - Unlicensed\\', ''],
	['Magazines\\', ''],
	['Applications (cdi)\\', ''],
	['Applications (elf)\\', ''],
	['Demos (cdi)\\', ''],
	['Demos (elf)\\', ''],
	[' (United States)', ' (USA)'],
	//['(PAL)', '(Europe)'], // does not seem to improve situation nowadays
	['(beta)', '(Beta)'],
	['(proto)', '(Proto)'],
	['[!]', ''],
	['[joystick]', ''],
	['Applications\\', ''],
	['&apos;', '\''],
	['[MIA] ', ''],
	[' (Track 1)', ''],
	[' (Made in Japan)', ''],
	[' (Aftermarket)', ''],
	[' (Unl)', ''],
	['Battletech - A Game of Armored Combat', 'BattleTech - A Game of Armored Combat'] // https://github.com/libretro/libretro-database/pull/1735
]

/**
 * Unclear TOSEC date indications, with the optional publisher that follows.
 */
const tosecDateRegexp = /\((?:19|20)(?:xx|\dx)\)(\([^()]*\))?/g

/**
 * Parentheticals that sit where a TOSEC publisher would, but are a flag rather
 * than a publisher.
 *
 * TOSEC's publisher field is positional and mandatory, so whatever follows the
 * release date is almost always the publisher and gets dropped with the date.
 * A handful of titles put a flag there instead, and dropping those loses real
 * information — a multi-disk set whose "(Disk 1 of 2)" is eaten collapses into
 * one name and comes back as an unrelated "(Alt n)".
 *
 * This list stays deliberately narrow. Anything looser swallows the publisher
 * abbreviations that fill the same slot: across the TOSEC and No-Intro inputs,
 * matching any two-letter code here would keep "(CP)", "(EA)" and 3,000 other
 * publishers in the titles to rescue 35 genuine flags.
 */
const datFlagRegexp = /^(?:Rev [\w.]+|RE\d|Alt(?: \d+)?|Proto|Beta(?: \d+)?|Demo|Sample|M\d+|(?:Dis[ck]|Tape|Track|Side) \d+(?: of \d+)?)$/

/**
 * Drop the publisher TOSEC places right after a release date, keeping whatever
 * is in that spot when it turns out to be a flag instead.
 */
function keepDatFlag(trailing) {
	if (!trailing) {
		return ''
	}
	return datFlagRegexp.test(trailing.slice(1, -1)) ? trailing : ''
}

/**
 * ISO country codes used by TOSEC, mapped to the region names No-Intro uses.
 * (NP) is left out, as it conflicts with the (NP) flag.
 */
const countryNames = {
	AE: 'United Arab Emirates',
	AL: 'Albania',
	AS: 'Asia',
	AT: 'Austria',
	AU: 'Australia',
	BA: 'Bosnia and Herzegovina',
	BE: 'Belgium',
	BG: 'Bulgaria',
	BR: 'Brazil',
	BY: 'Belarus',
	CA: 'Canada',
	CH: 'Switzerland',
	CL: 'Chile',
	CN: 'China',
	CS: 'Serbia and Montenegro',
	CY: 'Cyprus',
	CZ: 'Czech Republic',
	DE: 'Germany',
	DK: 'Denmark',
	EE: 'Estonia',
	EG: 'Egypt',
	ES: 'Spain',
	EU: 'Europe',
	FI: 'Finland',
	FR: 'France',
	GB: 'United Kingdom',
	GR: 'Greece',
	HK: 'Hong Kong',
	HR: 'Croatia',
	HU: 'Hungary',
	ID: 'Indonesia',
	IE: 'Ireland',
	IL: 'Israel',
	IN: 'India',
	IR: 'Iran',
	IS: 'Iceland',
	IT: 'Italy',
	JO: 'Jordan',
	JP: 'Japan',
	KR: 'Korea',
	LT: 'Lithuania',
	LU: 'Luxembourg',
	LV: 'Latvia',
	MN: 'Mongolia',
	MX: 'Mexico',
	MY: 'Malaysia',
	NL: 'Netherlands',
	NO: 'Norway',
	NZ: 'New Zealand',
	OM: 'Oman',
	PE: 'Peru',
	PH: 'Philippines',
	PL: 'Poland',
	PT: 'Portugal',
	QA: 'Qatar',
	RO: 'Romania',
	RU: 'Russia',
	SE: 'Sweden',
	SG: 'Singapore',
	SI: 'Slovenia',
	SK: 'Slovakia',
	TH: 'Thailand',
	TR: 'Turkey',
	TW: 'Taiwan',
	UA: 'Ukraine',
	US: 'USA',
	VN: 'Vietnam',
	YU: 'Yugoslavia',
	ZA: 'South Africa'
}

/**
 * Regions No-Intro lists first, in order. Remaining regions sort alphabetically.
 */
const regionOrder = ['Japan', 'USA', 'Europe']

/**
 * TOSEC language codes, mapped to the region the language implies. English is
 * simply dropped, like No-Intro does.
 */
const languageCountries = {
	bg: 'Bulgaria',
	cs: 'Czech Republic',
	da: 'Denmark',
	de: 'Germany',
	el: 'Greece',
	es: 'Spain',
	fi: 'Finland',
	fr: 'France',
	hr: 'Croatia',
	hu: 'Hungary',
	it: 'Italy',
	ja: 'Japan',
	ko: 'Korea',
	nl: 'Netherlands',
	no: 'Norway',
	pl: 'Poland',
	pt: 'Portugal',
	ro: 'Romania',
	ru: 'Russia',
	sk: 'Slovakia',
	sl: 'Slovenia',
	sv: 'Sweden',
	tr: 'Turkey',
	zh: 'China'
}

/**
 * Final title cleanups, applied after the date handling.
 */
const revisionReplacements = [
	['(RE1)', '(Rev 1)'],
	['(RE2)', '(Rev 2)'],
	['(RE3)', '(Rev 3)'],
	['(RE4)', '(Rev 4)'],
	['(RE5)', '(Rev 5)'],
	['(RE6)', '(Rev 6)'],
	[')(', ') (']
]

/**
 * Serials that should be treated as if there is no serial at all.
 */
const ignoreSerials = [
	'1',
	1,
	'n/a',
	'N/A',
	'!none'
]

/**
 * Verifies whether or not the entry is valid to be added to the DAT.
 */
function validEntry(gameName) {
	// Invalidate some of the entries.
	for (const substr of invalidSubstrings) {
		if (gameName.includes(substr)) {
			return false
		}
	}

	// The serial conflicts with Sonic Adventure 2
	// https://github.com/libretro/libretro-database/issues/1444
	if (gameName.includes('Phantasy Star Online') && gameName.includes('(Rev B)')) {
		return false
	}

	return true
}

/**
 * The filename the ROM is written out under, which must be a valid filename.
 */
function romFilename(rom) {
	return sanitizeFilename(path.basename(unidecode(rom.name)))
}

/**
 * Verifies whether or not the ROM itself belongs in the DAT.
 */
function validRom(rom) {
	// Skip any .sav files.
	return !romFilename(rom).includes('.sav')
}

/**
 * Find all files matching the given glob patterns, in pattern order.
 */
async function globAll(patterns) {
	const files = []
	for (const pattern of patterns) {
		const matches = await Array.fromAsync(fs.promises.glob(pattern))
		files.push(...matches.sort())
	}
	return files
}

/**
 * Act on a DAT file.
 */
async function processDat(datsInfo, name) {
	// Entries are turned off without losing their file patterns, so a disabled
	// DAT reports as such rather than looking like its input went missing.
	if (datsInfo.disabled) {
		console.log('DISABLED', name, `(${datsInfo.disabled})`)
		return {files: 0, games: 0, disabled: true}
	}

	// Retrieve all associated files for the DAT.
	const files = await globAll(datsInfo.files || [])
	if (files.length === 0) {
		console.log('EMPTY', name)
		return {files: 0, games: 0}
	}

	// Loop through each given XML file associated with the DAT.
	const results = []
	for (const file of files) {
		results.push(await processXml(file))
	}

	// Loop through the results and build a game database.
	const games = collectGames(results, name)
	if (Object.keys(games).length === 0) {
		return {files: files.length, games: 0}
	}

	let output = getHeader(name, pkg, getExtensions(games))

	// Loop through the sorted games database, and output the rom.
	for (const game of Object.keys(sort(games))) {
		const {rom, clean} = games[game]
		output += getGameEntry(game, clean, rom)
	}

	// Save the new DAT file.
	await fs.promises.writeFile(`${name}.dat`, output)
	return {files: files.length, games: Object.keys(games).length}
}

/**
 * Build the game database for a DAT, keyed by the name each game is written
 * out under.
 *
 * The titles are cleaned up before they are used as keys. Cleaning strips
 * release dates and publishers, so entries that look distinct in the source
 * ("Title (1991)(Ocean)" and "Title (1993)(Ocean)") can still collapse into
 * the same name. Keying on the cleaned title is what catches that collision.
 */
function collectGames(results, name) {
	const games = {}
	for (const result of results) {
		for (const game in result) {
			const entry = result[game]
			if (!validEntry(entry.title) || !validRom(entry)) {
				continue
			}

			const clean = cleanGameName(entry.title, name)

			// Distinguish games that share a name, but skip entries that are
			// identical to one already added under the same name.
			let gameName = clean.title
			let duplicate = false
			let alt = 1
			while (gameName in games) {
				if (sameEntry(games[gameName].rom, entry)) {
					duplicate = true
					break
				}
				gameName = `${clean.title} (Alt ${alt++})`
			}
			if (!duplicate) {
				games[gameName] = {rom: entry, clean}
			}
		}
	}
	return games
}

/**
 * The distinct file extensions the given games use, in alphabetical order.
 *
 * Entries without an extension are left out, rather than contributing an empty
 * entry to the list.
 */
function getExtensions(games) {
	const extensions = new Set()
	for (const game of Object.values(games)) {
		const extension = path.extname(romFilename(game.rom)).slice(1).toLowerCase()
		if (extension) {
			extensions.add(extension)
		}
	}
	return [...extensions].sort()
}

/**
 * Construct a header for a DAT file.
 */
function getHeader(name, pkg, extensions = []) {
	const now = new Date()
	const version = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
	let header = `clrmamepro (
	name "${path.basename(name)}"
	description "${path.basename(name)}"
	version "${version}"\n`
	if (extensions.length > 0) {
		header += `\textensions "${extensions.join('|')}"\n`
	}
	header += `	homepage "${pkg.homepage}"
)\n`
	return header
}

/**
 * Whether the DAT is built from TOSEC, which is the only source that puts
 * two-letter country and language codes in its titles.
 *
 * No-Intro and Redump use that same spot for platform and dumper tags, where
 * "Donkey Kong (USA) (GB) (Virtual Console)" means Game Boy rather than the
 * United Kingdom, so the codes are only translated for TOSEC.
 */
function isTosec(name) {
	return name.includes('/tosec/')
}

/**
 * Convert TOSEC country codes to No-Intro region names, including combined
 * codes: "(JP)" becomes "(Japan)", and "(EU-US)" becomes "(USA, Europe)".
 */
function normalizeCountries(gameName) {
	return gameName.replace(/\(([A-Z]{2}(?:-[A-Z]{2})*)\)/g, function (match, combined) {
		const codes = combined.split('-')
		if (!codes.every((code) => code in countryNames)) {
			return match
		}
		const rank = (region) => {
			const index = regionOrder.indexOf(region)
			return index === -1 ? regionOrder.length : index
		}
		const regions = codes.map((code) => countryNames[code])
			.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
		return '(' + regions.join(', ') + ')'
	})
}

/**
 * Convert TOSEC language codes: plain English is dropped, a single language
 * becomes the region it implies, and combined codes become No-Intro language
 * lists: "(en)" is removed, "(de)" becomes "(Germany)", and "(en-ja)" becomes
 * "(En,Ja)".
 */
function normalizeLanguages(gameName) {
	return gameName.replace(/\(([a-z]{2}(?:-[a-z]{2})*)\)/g, function (match, combined) {
		const codes = combined.split('-')
		if (!codes.every((code) => code === 'en' || code in languageCountries)) {
			return match
		}
		if (codes.length === 1) {
			return codes[0] === 'en' ? '' : '(' + languageCountries[codes[0]] + ')'
		}
		return '(' + codes.map((code) => code.charAt(0).toUpperCase() + code.slice(1)).join(',') + ')'
	})
}

/**
 * Clean up a game title, and pull the release date out of it.
 *
 * Returns the cleaned title, the release parameters the date produced, and the
 * original title, which the region detection still looks at.
 */
function cleanGameName(game, name) {
	// Replace Unicode characters, and trim the title.
	let gameName = unidecode(game).trim()

	// Remove the " of y" in " (Disc x of y)"
	const diskRegexp = /\(((Tape|Dis[ck]) \d{1,2}) of \d{1,2}\)/
	if (diskRegexp.test(gameName)) {
		gameName = gameName.replace(diskRegexp, '($1)')
	}

	// Parse release date and remove from title, along with the publisher that
	// TOSEC places right after it: "Title (1991)(Ocean)(JP)" keeps the year
	// and continues as "Title (JP)".
	let releaseParams = ''
	const dateRegexp = /\((\d{4})-?(\d{0,2})-?(\d{0,2})\)(\([^()]*\))?/
	const dateArray = dateRegexp.exec(gameName)
	if (dateArray !== null) {
		const year = parseInt(dateArray[1])
		if (year > 1950 && year <= new Date().getFullYear()) {
			releaseParams += `\n\treleaseyear "${dateArray[1]}"`
			if (dateArray[2] !== '' && parseInt(dateArray[2]) > 0 && parseInt(dateArray[2]) < 13) {
				releaseParams += `\n\treleasemonth "${dateArray[2]}"`
				if (dateArray[3] !== '' && parseInt(dateArray[3]) > 0 && parseInt(dateArray[3]) < 32) {
					releaseParams += `\n\treleaseday "${dateArray[3]}"`
				}
			}
			// A function keeps the flag from being read as a $ replacement.
			gameName = gameName.replace(dateRegexp, () => keepDatFlag(dateArray[4]))
		}
	}

	// Remove unclear TOSEC date indications, and their publisher.
	gameName = gameName.replace(tosecDateRegexp, (match, trailing) => keepDatFlag(trailing))

	// Clean the name some more.
	for (const [from, to] of titleReplacements) {
		gameName = gameName.replaceAll(from, to)
	}

	// Turn TOSEC country and language codes into No-Intro style names.
	if (isTosec(name)) {
		gameName = normalizeCountries(gameName)
		gameName = normalizeLanguages(gameName)
	}

	// Remove TOSEC multi-language counters like "(M3)".
	gameName = gameName.replace(/\(M\d\)/g, '')

	// Final cleanups: revisions, parenthesis spacing and whitespace collapsing.
	for (const [from, to] of revisionReplacements) {
		gameName = gameName.replaceAll(from, to)
	}
	gameName = gameName.replace(/ {2,}/g, ' ')
		.replace(/\(([^()]+)\) \(\1\)/g, '($1)')
		.trim()

	// Protect against #### - Game Name (Country) -- Remove the prefixing numbers.
	// Game Boy Advance only does this numbering?
	if (name.includes('Game Boy Advance') || name.includes('Nintendo DS')) {
		if (/^[0-9xyz][0-9][0-9][0-9] - /.test(gameName)) {
			gameName = gameName.substring(7)
		}
	}

	return {raw: game, title: gameName, releaseParams}
}

/**
 * Construct a game entry for a DAT file, under the given name.
 */
function getGameEntry(gameName, clean, rom) {
	let extraParams = clean.releaseParams
	const gameFile = romFilename(rom)

	let gameParams = `name "${gameFile}"`
	if (rom.size) {
		gameParams += ` size ${rom.size}`
	}
	if (rom.crc) {
		gameParams += ` crc ${rom.crc.toUpperCase()}`
	}
	if (rom.md5) {
		gameParams += ` md5 ${rom.md5.toUpperCase()}`
	}
	if (rom.sha1) {
		gameParams += ` sha1 ${rom.sha1.toUpperCase()}`
	}

	for (const country of countries) {
		if (clean.raw.includes('(' + country + ')') || gameName.includes('(' + country + ')')) {
			extraParams += `\n\tregion "${country}"`
			break
		}
		if (clean.raw.includes('(' + country + ', ') || gameName.includes('(' + country + ', ')) {
			extraParams += `\n\tregion "${country}"`
			break
		}
	}

	// Handle when there's a serial.
	if (rom.serial && !ignoreSerials.includes(rom.serial.trim())) {
		// Multiple serial split into multiple games.
		let separator = ' / '
		if (rom.serial.includes(', ')) {
			separator = ', '
		}

		const serials = rom.serial.split(separator)
		let output = ''
		for (let serial of serials) {
			let ogParams = extraParams
			serial = cleanSerial(serial)
			if (serial) {
				const discNumber = grabDiscNumber(gameName)
				if (discNumber !== false) {

					output += `\ngame (
	name "${gameName}"${ogParams}
	serial "${serial}"
	rom ( ${gameParams} serial "${serial}" )
)`

					serial = serial + '-' + (discNumber - 1).toString()
				}
				ogParams += `\n\tserial "${serial}"`
				output += `\ngame (
	name "${gameName}"${ogParams}
	rom ( ${gameParams} serial "${serial}" )
)`
			}
		}
		return output
	}

	return `\ngame (
	name "${gameName}"${extraParams}
	rom ( ${gameParams} )
)`
}

/**
 * Determine whether two game entries describe the same ROM.
 */
function sameEntry(a, b) {
	return Boolean((a.crc && a.crc === b.crc) || (a.serial && a.serial === b.serial))
}

/**
 * Grab the disc number from a game name, or false when there is none.
 */
function grabDiscNumber(gameName) {
	const match = gameName.replace('(Disk ', '(Disc ').match(/\(Disc (\d+)/)
	if (match) {
		const output = parseInt(match[1])
		if (!Number.isNaN(output)) {
			return output
		}
	}
	return false
}

/**
 * Clean up a serial number.
 */
function cleanSerial(serial) {
	if (!serial) {
		return ''
	}
	let output = serial
		.trim()
		.replaceAll(' ', '-')
		.replaceAll('#', '')
	if (output.charAt(0) == '-') {
		output = output.substring(1)
	}
	return output.trim()
}

/**
 * Process the given XML file.
 */
async function processXml(filepath) {
	if ((await fs.promises.lstat(filepath)).isDirectory()) {
		return {}
	}

	// Read in the file asyncronously.
	const data = await fs.promises.readFile(filepath, {encoding: 'utf8'})

	// Convert the string to a JSON object.
	console.log(filepath)
	let dat
	try {
		dat = await xml.parseStringPromise(data)
	}
	catch (err) {
		// The parser only reports where in the document it gave up, so the file
		// it was reading is worth saying out loud.
		throw new Error(`Could not parse ${filepath}: ${err.message}`)
	}

	// Convert the JSON object to a Games array.
	return getGamesFromXml(filepath, dat)
}

/**
 * The first value of an XML field. xml2js hands every one back as an array.
 */
function xmlValue(value) {
	return Array.isArray(value) ? value[0] : value
}

/**
 * The name a DAT gives itself in its header, for logging. The header is
 * optional, so this falls back to the file path.
 */
function datName(header, filepath) {
	return xmlValue(xmlValue(header.header)?.name) || filepath
}

/**
 * Convert an XML dat object to a games array.
 */
function getGamesFromXml(filepath, dat) {
	const dir = path.dirname(filepath)
	const out = {}
	const root = 'datafile' in dat ? dat.datafile : dat.dat
	if (root === undefined) {
		throw new Error(`Unrecognized DAT in ${filepath}: expected a <datafile> or <dat> root element, found <${Object.keys(dat).join('>, <')}>`)
	}

	// An empty <datafile/> parses to a string rather than an object, so there is
	// nothing to read games out of.
	const header = typeof root === 'object' && root !== null ? root : null
	if (!header) {
		console.log('No Games Found: ', filepath)
		return {}
	}

	let games = header.machine || header.game || null
	// Find the games array.
	if (!games) {
		if (xmlValue(header.games)?.game) {
			games = xmlValue(header.games).game
		}
		else {
			console.log('No Games Found: ', datName(header, filepath))
			return {}
		}
	}

	// Loop through each game.
	games.forEach(function (game, i) {
		// Set up the entries to watch for.
		let title = null
		let largestData = 0
		let dataTracks = []
		let finalPrimary = null
		let finalBin = null
		let finalIso = null
		let finalImg = null
		let finalEntry = null

		// Find all the entries.
		if (game.rom) {
			if (game.title) {
				title = xmlValue(game.title)
			}
			else if (game['$'] && game['$'].name) {
				title = game['$'].name
			}
			else if (xmlValue(game.description)) {
				title = xmlValue(game.description)
			}
			else if (xmlValue(game.rom)['$']) {
				title = path.basename(xmlValue(game.rom)['$'].name)
			}
			else {
				throw new Error(`Could not find title in ${filepath} for game ${i}: ${JSON.stringify(game)}`)
			}

			for (const entry of game.rom) {
				const rom = entry['$']
				const lowerCaseName = rom.name.toLowerCase()
				const extname = path.extname(lowerCaseName)
				if (lowerCaseName.endsWith('.cue')) {
					dataTracks = cueDataTracks(path.join(dir, rom.name))
				}
				else if (lowerCaseName.endsWith('.gdi')) {
					dataTracks = gdiDataTracks(path.join(dir, rom.name))
				}
				else if (dataTracks.includes(rom.name) && Number(rom.size) > largestData) {
					finalPrimary = rom
					largestData = Number(rom.size)
				}
				else if (lowerCaseName.endsWith('.bin') && !finalBin) {
					finalBin = rom
				}
				else if (lowerCaseName.endsWith('.iso') && !finalIso) {
					finalIso = rom
				}
				else if (lowerCaseName.endsWith('.img') && !finalImg) {
					finalImg = rom
				}
				else if (lowerCaseName.endsWith('.txt')) {
					// Ignore text files
				}
				else if (extname == '.snd') {
					// Ignore
				}
				else if (extname == '.cg1') {
					// Ignore
				}
				else if (extname == '.eg1') {
					// Ignore
				}
				else if (extname == '.mg1') {
					// Ignore
				}
				else if (extname == '.ptn777') {
					// Ignore, Epoch Cassette Vision's bin777 is more important
				}
				/* We'll be adding the no-extensions for now.
				else if (extname.length == 0) {
					// Ignore zero extension
				}
				*/
				else {
					finalEntry = rom
				}
			}
		}
		else {
			// Nothing in the entry describes a ROM, so there is nothing to add.
			console.log(`No ROM entries for game ${i} in ${filepath}:`, game['$'] || game)
			return
		}

		// Choose which entry to use.
		const final = finalPrimary || finalBin || finalIso || finalImg || finalEntry
		if (final) {
			final.title = title
			if (game.serial) {
				final.serial = xmlValue(game.serial)
			}
			if (final.crc) {
				out[final.crc] = final
			}
			else if (final.status == 'nodump') {
				// Nothing.
				console.log('No dump for ' + final.title)
			}
			else {
				console.log("Couldn't find key for....")
				console.log(final)
			}
		}
	})
	return out
}

/**
 * Find the data tracks listed in a cue sheet.
 */
function cueDataTracks(filepath) {
	let data
	try {
		data = fs.readFileSync(filepath, {encoding: 'utf8'})
	} catch (err) {
		return []
	}

	const fileStmt = /^\s*FILE\s+"([^"]+)"\s+(.*)$/
	const trackStmt = /^\s*TRACK\s+(\d+)\s+(.*)$/

	const tracks = []
	let lastFile = null

	for (const line of data.split(/\r?\n/)) {
		let match = line.match(fileStmt)
		if (match) {
			lastFile = match[1]
			continue
		}
		match = line.match(trackStmt)
		if (match && lastFile != null && match[2] != 'AUDIO') {
			tracks.push(lastFile)
		}
	}

	return tracks
}

/**
 * Find the data tracks listed in a gdi file.
 */
function gdiDataTracks(filepath) {
	let data
	try {
		data = fs.readFileSync(filepath, {encoding: 'utf8'})
	} catch (err) {
		return []
	}

	const stmt = /^\s*\d+\s+\d+\s+(\d+)\s+(\d+)\s+"([^"]+)"\s+\d+$/

	const tracks = []

	// The first line only holds the track count.
	for (const line of data.split(/\r?\n/).slice(1)) {
		const match = line.match(stmt)
		if (match && !(match[1] == 0 && match[2] == 2352)) {
			tracks.push(match[3])
		}
	}

	return tracks
}

module.exports = {
	cleanGameName,
	cleanSerial,
	collectGames,
	cueDataTracks,
	gdiDataTracks,
	getExtensions,
	getGameEntry,
	getGamesFromXml,
	getHeader,
	getOptions,
	grabDiscNumber,
	isTosec,
	keepDatFlag,
	normalizeCountries,
	normalizeLanguages,
	processDat,
	reportRun,
	romFilename,
	sameEntry,
	validEntry,
	validRom
}
