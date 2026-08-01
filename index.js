const fs = require('fs')
const path = require('path')
const pkg = require('./package')
const xml = require('xml2js').Parser()
const sort = require('sort-keys')
const unidecode = require('unidecode')
const sanitizeFilename = require('sanitize-filename')
const dats = require('./dats.json')
const countries = require('./countries.json')
const download = require('./download')

async function start() {
	await download()
	for (const [name, datsInfo] of Object.entries(dats)) {
		await processDat(datsInfo, name)
	}
}

start().catch(function (err) {
	console.error(err)
	process.exitCode = 1
})

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
	[' (Unl)', '']
]

/**
 * Unclear TOSEC date indications, with the optional publisher that follows.
 */
const tosecDateRegexp = /\((?:19|20)(?:xx|\dx)\)(?:\([^()]*\))?/g

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
	// Retrieve all associated files for the DAT.
	const files = await globAll(datsInfo.files || [])
	if (files.length === 0) {
		console.log('EMPTY', name)
		return
	}

	// Loop through each given XML file associated with the DAT.
	const results = []
	for (const file of files) {
		results.push(await processXml(file))
	}

	// Loop through the results and build a game database.
	const games = {}
	for (const result of results) {
		for (const game in result) {
			const entry = result[game]
			let gameName = entry.title
			if (validEntry(gameName)) {
				// Find a unique key, but skip entries that are identical
				// to one already added under the same name.
				let duplicate = false
				while (gameName in games) {
					if (sameEntry(games[gameName], entry)) {
						duplicate = true
						break
					}
					gameName = gameName + ' '
				}
				if (!duplicate) {
					games[gameName] = entry
				}
			}
		}
	}

	if (Object.entries(games).length === 0) {
		return
	}
	let output = getHeader(name, pkg)

	// Loop through the sorted games database, and output the rom.
	for (let game in sort(games)) {
		const rom = games[game]
		game = game.trim()
		output += getGameEntry(game, rom, name)
	}

	// Save the new DAT file.
	await fs.promises.writeFile(`${name}.dat`, output)
}

/**
 * Construct a header for a DAT file.
 */
function getHeader(name, pkg) {
	const now = new Date()
	const version = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
	return `clrmamepro (
	name "${path.basename(name)}"
	description "${path.basename(name)}"
	version "${version}"
	homepage "${pkg.homepage}"
)\n`
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
 * Construct a game entry for a DAT file.
 */
function getGameEntry(game, rom, name) {
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
	let extraParams = ''
	const dateRegexp = /\((\d{4})-?(\d{0,2})-?(\d{0,2})\)(?:\([^()]*\))?/
	const dateArray = dateRegexp.exec(gameName)
	if (dateArray !== null) {
		const year = parseInt(dateArray[1])
		if (year > 1950 && year <= new Date().getFullYear()) {
			extraParams += `\n\treleaseyear "${dateArray[1]}"`
			if (dateArray[2] !== '' && parseInt(dateArray[2]) > 0 && parseInt(dateArray[2]) < 13) {
				extraParams += `\n\treleasemonth "${dateArray[2]}"`
				if (dateArray[3] !== '' && parseInt(dateArray[3]) > 0 && parseInt(dateArray[3]) < 32) {
					extraParams += `\n\treleaseday "${dateArray[3]}"`
				}
			}
			gameName = gameName.replace(dateRegexp, '')
		}
	}

	// Remove unclear TOSEC date indications, and their publisher.
	gameName = gameName.replace(tosecDateRegexp, '')

	// Clean the name some more.
	for (const [from, to] of titleReplacements) {
		gameName = gameName.replaceAll(from, to)
	}

	// Turn TOSEC country and language codes into No-Intro style names.
	gameName = normalizeCountries(gameName)
	gameName = normalizeLanguages(gameName)

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

	// The filename must be a valid filename.
	const gameFile = sanitizeFilename(path.basename(unidecode(rom.name)))

	// Skip any .sav files.
	if (gameFile.includes('.sav')) {
		return ''
	}

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
		if (game.includes('(' + country + ')') || gameName.includes('(' + country + ')')) {
			extraParams += `\n\tregion "${country}"`
			break
		}
		if (game.includes('(' + country + ', ') || gameName.includes('(' + country + ', ')) {
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
	return (a.crc && a.crc === b.crc) || (a.serial && a.serial === b.serial)
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
	const dat = await xml.parseStringPromise(data)

	// Convert the JSON object to a Games array.
	return getGamesFromXml(filepath, dat)
}

/**
 * Convert an XML dat object to a games array.
 */
function getGamesFromXml(filepath, dat) {
	const dir = path.dirname(filepath)
	const out = {}
	const header = dat.datafile || dat.dat
	let games = header.machine || header.game || null
	// Find the games array.
	if (!games) {
		if (header.games && header.games[0] && header.games[0].game) {
			games = header.games[0].game
		}
		else {
			console.log('No Games Found: ', header.header[0].name[0])
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
				title = game.title
			}
			else if (game['$'] && game['$'].name) {
				title = game['$'].name
			}
			else if (game.description && game.description[0]) {
				title = game.description[0]
			}
			else if (game.rom[0]['$']) {
				title = path.basename(game.rom[0]['$'].name)
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
		else if (!game.trurip) {
			// AdvanceSCENE
			title = game.title
			finalIso = {
				name: game.title + '.iso',
				size: game.romSize,
				serial: game.serial,
				crc: game.files[0].romCRC[0]['_']
			}
		}
		else {
			console.log('Could not entry for....')
			if (game['$']) {
				console.log(game['$'], i)
			}
			else {
				console.log(game, i)
			}
			return
		}

		// Choose which entry to use.
		const final = finalPrimary || finalBin || finalIso || finalImg || finalEntry
		if (final) {
			final.title = title
			if (game.serial) {
				final.serial = game.serial[0]
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
