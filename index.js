const fs = require('fs')
const path = require('path')
const pkg = require('./package')
const async = require('async')
const glob = require('multi-glob').glob
const xml = require('xml2js').Parser()
const sort = require('sort-object')
const unidecode = require('unidecode')
const sanitizeFilename = require('sanitize-filename')
const dats = require('./dats.json')

// Process all the dats.
async.mapValues(dats, processDat, function (err, results) {
	if (err) {
		throw err
	}
})

/**
 * Act on a DAT file.
 */
function processDat(datsInfo, name, done) {
	// Retrieve all associated files for the DAT.
	glob(datsInfo.files, function (err, files) {
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
					// Do not add BIOS entries.
					if (gameName.indexOf('[BIOS]') < 0) {
						while (gameName in games) {
							gameName = gameName + ' '
						}
						games[gameName] = results[i][game]
					}
				}
			}

			var output = getHeader(name, pkg)

			// Loop through the sorted games database, and output the rom.
			for (var game in sort(games)) {
				var rom = games[game]
				game = game.trim()
				output += getGameEntry(game, rom)
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
	return `clrmamepro (
	name "${path.basename(name)}"
	description "${path.basename(name)}"
	version "${pkg.version}"
	homepage "${pkg.homepage}"
)\n`
}

/**
 * Construct a game entry for a DAT file.
 */
function getGameEntry(game, rom) {
	// Replace Unicode characters, and trim the title.
	let gameName = unidecode(game).trim();
	// The filename must be a valid filename.
	let gameFile = sanitizeFilename(path.basename(unidecode(rom.name)))

	let gameParams = `name "${gameFile}"`
	if (rom.size) {
		gameParams += ` size ${rom.size}`
	}
	if (rom.crc) {
		gameParams += ` crc ${rom.crc}`
	}
	if (rom.md5) {
		gameParams += ` md5 ${rom.md5}`
	}
	if (rom.sha1) {
		gameParams += ` sha1 ${rom.sha1}`
	}

	return `\ngame (
	name "${gameName}"
	description "${gameName}"
	rom ( ${gameParams} )
)\n`
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
		xml.parseString(data, (error, dat) => {
			if (error) {
				return done(error)
			}

			// Convert the JSON object to a Games array.
			var result = getGamesFromXml(dat)

			// We have the result, move to the next one.
			done(null, result)
		})
	})
}

/**
 * Convert an XML dat object to a games array.
 */
function getGamesFromXml(dat) {
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
		var finalCue = null
		var finalIso = null
		var finalGdi = null
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
				if (rom.name.indexOf('.cue') >= 0 && !finalCue) {
					finalCue = rom
				}
				else if (rom.name.indexOf('.iso') >= 0 && !finalIso) {
					finalIso = rom
				}
				else if (rom.name.indexOf('.gdi') >= 0 && !finalGdi) {
					finalGdi = rom
				}
				else if (rom.name.indexOf('.img') >= 0 && !finalImg) {
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
		if (finalCue) {
			final = finalCue
		}
		else if (finalGdi) {
			final = finalGdi
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
