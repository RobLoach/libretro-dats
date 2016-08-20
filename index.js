const fs = require('fs')
const path = require('path')
const pkg = require('./package')
const async = require('async')
const glob = require('multi-glob').glob
const xml = require('xml2js').Parser()
const rimraf = require('rimraf')
const sort = require('sort-object')
const dats = require('./dats.json')

// Clear out the dat folder.
rimraf('dat', function () {
	fs.mkdir('dat', function () {
		// Process each DAT file.
		async.mapValues(dats, processDat, function (err, results) {
			if (err)
				throw err
		})
	})
})

/**
 * Act on a DAT file.
 */
function processDat(datsInfo, name, done) {
	// Retrieve all associated files for the DAT.
	glob(datsInfo.files, function (err, files) {
		// Output the files to the user.
		console.log(name, files)
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
					var gameName = game
					while (gameName in games) {
						gameName = gameName + ' '
					}
					games[gameName] = results[i][game]
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
			var outputFile = `dat/${name}.dat`
			console.log(outputFile)
			fs.writeFile(outputFile, output, done)
		})
	})
}

/**
 * Construct a header for a DAT file.
 */
function getHeader(name, pkg) {
	return `clrmamepro (
	name "${name}"
	description "${name}"
	version "${pkg.version}"
	comment "${pkg.description}"
	homepage "${pkg.homepage}"
)\n`
}

/**
 * Construct a game entry for a DAT file.
 */
function getGameEntry(game, rom) {
	return `\ngame (
	name "${game}"
	description "${game}"
	rom ( name "${path.basename(rom.name)}" size ${rom.size} crc ${rom.crc} md5 ${rom.md5} sha1 ${rom.sha1} )
)\n`
}

/**
 * Process the given XML file.
 */
function processXml(filepath, done) {
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

	// Loop through each game.
	for (var i in dat.datafile.game) {
		// Set up the entries to watch for.
		var game = dat.datafile.game[i]
		var finalCue = null
		var finalIso = null
		var finalGdi = null
		var finalImg = null
		var finalEntry = null

		// Find all the entries.
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

		// Choose which entry to use.
		if (finalCue) {
			out[game.description[0]] = finalCue
		}
		else if (finalGdi) {
			out[game.description[0]] = finalGdi
		}
		else if (finalIso) {
			out[game.description[0]] = finalIso
		}
		else if (finalImg) {
			out[game.description[0]] = finalImg
		}
		else if (finalEntry) {
			out[game.description[0]] = finalEntry
		}
	}

	return out
}
