const fs = require('fs')
const path = require('path')
const pkg = require('./package')
const async = require('async')
const glob = require('multi-glob').glob
const xml = require('xml2js').Parser()
const sort = require('sort-keys')
const unidecode = require('unidecode')
const sanitizeFilename = require('sanitize-filename')
const dats = require('./dats.json')
const request = require('request')
const download = require('./download')
const replaceAll = require('replace-string')
const dateFormat = require('dateformat')

async function start() {
	await download()
	async.mapValues(dats, processDat, function (err, results) {
		if (err) {
			throw err
		}
	})
}

start()

/**
 * Verifies whether or not the entry is valid to be added to the DAT.
 */
function validEntry(gameName) {
	// Skip all BIOS files.
	if (gameName.indexOf('[BIOS]') >= 0) {
		return false
	}
	
	// Skip all bad dumps
	if (gameName.indexOf('[b]') >= 0) {
		return false
	}

	// Skip all programs.
	if (gameName.indexOf('(Test Program)') >= 0) {
		return false
	}
	if (gameName.indexOf('(Program)') >= 0) {
		return false
	}
	if (gameName.indexOf('- Program -') >= 0) {
		return false
	}
	if (gameName.indexOf('Test Cartridge') >= 0) {
		return false
	}
	if (gameName.indexOf('Super Nintendo Tester') >= 0) {
		return false
	}

	return true
}

/**
 * Act on a DAT file.
 */
function processDat(datsInfo, name, done) {
	// Retrieve all associated files for the DAT.
	glob(datsInfo.files, function (err, files) {
		if (!files) {
			console.log('EMPTY', name)
		}
		// Output the files to the user.
		//console.log(name, files)
		// Loop through each given XML file associated with the DAT.
		async.map(files, processXml, function (err, results) {
			// Error handling.
			if (err) {
				return done(err)
			}

			// Loop through the results and build a game database.
			var games = {}
			for (var i in results) {
				for (var game in results[i]) {
					var gameName = results[i][game].title
					if (validEntry(gameName)) {
						while (gameName in games) {
							gameName = gameName + ' '
						}
						games[gameName] = results[i][game]
					}
				}
			}

			if (Object.entries(games).length === 0) {
				return
			}
			var output = getHeader(name, pkg)

			// Loop through the sorted games database, and output the rom.
			for (let game in sort(games)) {
				let rom = games[game]
				game = game.trim()
				let gameOutput = getGameEntry(game, rom, name)
				output += gameOutput
			}

			// Save the new DAT file.
			var outputFile = `${name}.dat`
			//console.log(outputFile)
			fs.writeFile(outputFile, output, done)
		})
	})
}

/**
 * Construct a header for a DAT file.
 */
function getHeader(name, pkg) {
	const version = dateFormat(new Date(), "yyyy.mm.dd")
	return `clrmamepro (
	name "${path.basename(name)}"
	description "${path.basename(name)}"
	version "${version}"
	homepage "${pkg.homepage}"
)\n`
}

/**
 * Construct a game entry for a DAT file.
 */
function getGameEntry(game, rom, name) {
	// Replace Unicode characters, and trim the title.
	let gameName = unidecode(game).trim();

	// Clean the name some more.
	gameName = gameName
		.replace('Games (Europe)\\', '')
		.replace('Games\\', '')
		.replace('Games (USA)\\', '')
		.replace('Games (Japan)\\', '')
		.replace('Games (cdi)\\', '')
		.replace('Games (elf)\\', '')
		.replace('MISSING\\', '')
		.replace('Samplers\\', '')
		.replace('Multimedia\\', '')
		.replace('(Sony Imagesoft)', '')
		.replace('(Sony)', '')
		.replace('(Sega)', '')
		.replace('(Riot)', '')
		.replace('(Bignet - Micronet)', '')
		.replace('(Bignet)', '')
		.replace('(M4)', '')
		.replace('(Acclaim - Domark)', '')
		.replace('(Acclaim)', '')
		.replace('(Gametek)', '')
		.replace('(Good Deal Games)', '')
		.replace('(Good Deal Games - Stargate Films)', '')
		.replace('(Sega - Tec Toy)', '')
		.replace('(SIMS)', '')
		.replace('(Sims)', '')
		.replace('(Tecmo)', '')
		.replace('(Sensible Software - Sony)', '')
		.replace('(Taito)', '')
		.replace('(Infogrames)', '')
		.replace('(Interplay)', '')
		.replace('(Domark)', '')
		.replace('(Pony Canyon)', '')
		.replace('(Panasonic)', '')
		.replace('(LG)', '')
		.replace('(Yoshimoto Kogyo)', '')
		.replace('(Studio 3DO)', '')
		.replace('(GoldStar)', '')
		.replace('(Human)', '')
		.replace('(Bandai)', '')
		.replace('(Activision)', '')
		.replace('(Infomedia)', '')
		.replace('(RE)', '')
		.replace('(Data East - Sega)', '')
		.replace('(ReadySoft)', '')
		.replace('(Virgin)', '')
		.replace('[a]', '(Alt 1)')
		.replace('[a1]', '(Alt 1)')
		.replace('[a2]', '(Alt 2)')
		.replace('[a3]', '(Alt 3)')
		.replace('[a4]', '(Alt 4)')
		.replace('[a5]', '(Alt 5)')
		.replace('[a6]', '(Alt 6)')
		.replace('[a7]', '(Alt 7)')
		.replace('[a8]', '(Alt 8)')
		.replace('[a9]', '(Alt 9)')
		.replace('[a10]', '(Alt 10)')
		.replace('[a11]', '(Alt 11)')
		.replace('(EA Sports)', '')
		.replace('(Electronic Arts)', '')
		.replace('(Digital Pictures)', '')
		.replace('(Good Deal Games - Oldergames)', '')
		.replace('(Victor)', '')
		.replace('(JVC)', '')
		.replace('(Wolf Team)', '')
		.replace('(Polydor K.K.)', '')
		.replace('(NTSC)', '')
		.replace(' (Mega Power)', '')
		.replace(' (SMW Hack)', '')
		.replace('Games - Unlicensed\\', '')
		.replace('Magazines\\', '')
		.replace('Applications (cdi)\\', '')
		.replace('Applications (elf)\\', '')
		.replace('Demos (cdi)\\', '')
		.replace('Demos (elf)\\', '')
		.replace(' (United States)', ' (USA)')
		.replace('(PAL)', '(Europe)')
		.replace('(EU)', '(Europe)')
		.replace('(en)', '')
		.replace(')(beta)', ') (Beta)')
		.replace('(fr)', '(France)')
		.replace('(es)', '(Spain)')
		.replace('(JP)', '(Japan)')
		.replace('(US)', '(USA)')
		.replace('(proto)', '(Proto)')
		.replace('[!]', '')
		.replace('[joystick]', '')
		.replace('Applications\\', '')
		.replace('&apos;', '\'')
		.replace('[MIA] ', '')
	
	// Remove the " of y" in " (Disc x of y)"
	for (let discX = 1; discX < 10; discX++) {
		for (let discY = discX; discY < 10; discY++) {
			gameName.replace(` (Disc ${discX} of ${discY})`, ` (Disc ${discX})`)
		}
	}

	for (var yearnum = 1984; yearnum <= 2020; yearnum++) {
		gameName = gameName.replace('(' + yearnum + ')', '')
	}
	gameName = gameName.replace('  ', ' ')
		.replace('(RE1)', '(Rev 1)')
		.replace('(RE2)', '(Rev 2)')
		.replace('(RE3)', '(Rev 3)')
		.replace('(RE4)', '(Rev 4)')
		.replace('(RE5)', '(Rev 5)')
		.replace('(RE6)', '(Rev 6)')
		.replace(')(', ') (')
		.replace(')(', ') (')
		.replace(')(', ') (')
		.replace(')(', ') (')
		.trim()
	
	// Protect against #### - Game Name (Country) -- Remove the prefixing numbers.
	// Game Boy Advance only does this numbering?
	if (name.includes('Game Boy Advance')) {
		if (/^[0-9][0-9][0-9][0-9] - /.test(gameName)) {
			gameName = gameName.substring(7)
		}
	}

	// The filename must be a valid filename.
	let gameFile = sanitizeFilename(path.basename(unidecode(rom.name)))
	
	// Skip any .sav files.
	if (gameFile.indexOf('.sav') >= 0) {
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

	let extraParams = ''
	let countries = require('./countries')
	for (let country of countries) {
		if (game.includes('(' + country + ')')) {
			extraParams += `\n\tregion "${country}"`
		}
	}

	// Handle when there's a serial.
	let ignoreserials = [
		'1',
		1,
		'n/a',
		'N/A',
		'!none'
	]
	if (rom.serial && !ignoreserials.includes(rom.serial.trim())) {
		// Multiple serial split into multiple games.
		let seperator = ' / '
		if (rom.serial.includes(', ')) {
			seperator = ', '
		}

		let serials = rom.serial.split(seperator)
		let output = ''
		for (let serial of serials) {
			let ogParams = extraParams
			serial = cleanSerial(serial)
			if (serial) {
				let discNumber = grabDiscNumber(gameName)
				if (discNumber !== false) {

					output += `\ngame (
	name "${gameName}"
	description "${gameName}"${ogParams}
	serial "${serial}"
	rom ( ${gameParams} serial "${serial}" )
)`

					serial = serial + '-' + (discNumber - 1).toString()
				}
				ogParams += `\n\tserial "${serial}"`
				output += `\ngame (
	name "${gameName}"
	description "${gameName}"${ogParams}
	rom ( ${gameParams} serial "${serial}" )
)`
			}
		}
		return output
	}

	return `\ngame (
	name "${gameName}"
	description "${gameName}"${extraParams}
	rom ( ${gameParams} )
)`
}

function grabDiscNumber(gameName) {
	gameName = gameName.replace('(Disk ', '(Disc ')
	const regex = /\(Disc (\d+)/gm;
	let m;

	while ((m = regex.exec(gameName)) !== null) {
		// This is necessary to avoid infinite loops with zero-width matches
		if (m.index === regex.lastIndex) {
			regex.lastIndex++
		}
		let output = parseInt(m[1])
		if (!Number.isNaN(output)) {
			return output
		}
	}

	return false
}

function cleanSerial(serial) {
	if (!serial) {
		return ''
	}
	let output = serial.trim()
	output = replaceAll(output, ' ', '-')
	output = replaceAll(output, '#', '')
	if (output.charAt(0) == '-') {
		output = output.substr(1)
	}
	return output.trim()
}

/**
 * Process the given XML file.
 */
function processXml(filepath, done) {
	if (fs.lstatSync(filepath).isDirectory()) {
		return done(null, [])
	}
	// Read in the file asyncronously.
	fs.readFile(filepath, {encoding: 'utf8'}, (err, data) => {
		if (err) {
			return done(err)
		}

		// Convert the string to a JSON object.
		console.log(filepath)
		xml.parseString(data, (error, dat) => {
			if (error) {
				return done(error)
			}

			// Convert the JSON object to a Games array.
			var result = getGamesFromXml(filepath, dat)

			// We have the result, move to the next one.
			done(null, result)
		})
	})
}

/**
 * Convert an XML dat object to a games array.
 */
function getGamesFromXml(filepath, dat) {
	var dir = path.dirname(filepath)
	var out = {}
	var header = dat.datafile || dat.dat
	var games = header.machine || header.game || null
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
		var title = null
		var largestData = 0
		var dataTracks = []
		var finalPrimary = null
		var finalBin = null
		var finalIso = null
		var finalImg = null
		var finalEntry = null

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
				console.log('Could not find title for....')
				console.log(game, i)
				process.exit()
			}
			for (var x in game.rom) {
				var rom = game.rom[x]['$']
				if (rom.name.endsWith('.cue')) {
					dataTracks = cueDataTracks(path.join(dir, rom.name))
				}
				else if (rom.name.endsWith('.gdi')) {
					dataTracks = gdiDataTracks(path.join(dir, rom.name))
				}
				else if (dataTracks.includes(rom.name) && Number(rom.size) > largestData) {
					finalPrimary = rom
					largestData = Number(rom.size)
				}
				else if (rom.name.endsWith('.bin') && !finalBin) {
					finalBin = rom
				}
				else if (rom.name.endsWith('.iso') && !finalIso) {
					finalIso = rom
				}
				else if (rom.name.endsWith('.img') && !finalImg) {
					finalImg = rom
				}
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
			return;
		}

		// Choose which entry to use.
		var final = null
		if (finalPrimary) {
			final = finalPrimary
		}
		else if (finalBin) {
			final = finalBin
		}
		else if (finalIso) {
			final = finalIso
		}
		else if (finalImg) {
			final = finalImg
		}
		else if (finalEntry) {
			final = finalEntry
		}
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
				console.log("No dump for " + final.title)
			}
			else {
				console.log("Couldn't find key for....")
				console.log(final)
				//process.exit()
			}
		}
	})
	return out
}

function cueDataTracks(filepath) {
		var data
		try {
			data = fs.readFileSync(filepath, {encoding: 'utf8'})
		} catch (err) {
				return []
		}

		var fileStmt = /^\s*FILE\s+"([^"]+)"\s+(.*)$/
		var trackStmt = /^\s*TRACK\s+(\d+)\s+(.*)$/

		var tracks = []
		var lastFile = null

		lines = data.split(/\r?\n/)
		for (var line in lines) {
				line = lines[line]
				var match
				match = line.match(fileStmt)
				if (match) {
						lastFile = match[1]
						continue
				}
				match = line.match(trackStmt)
				if (match && lastFile != null && match[2] != "AUDIO") {
						tracks.push(lastFile)
				}
		}

		return tracks
}

function gdiDataTracks(filepath) {
		var data
		try {
			data = fs.readFileSync(filepath, {encoding: 'utf8'})
		} catch (err) {
				return []
		}

		var stmt = /^\s*\d+\s+\d+\s+(\d+)\s+(\d+)\s+"([^"]+)"\s+\d+$/

		var tracks = []

		lines = data.split(/\r?\n/)
		for (var line in lines) {
				if (line == 0) {
						continue
				}
				line = lines[line]
				var match
				match = line.match(stmt)
				if (match && !(match[1] == 0 && match[2] == 2352)) {
						tracks.push(match[3])
				}
		}

		return tracks
}
