const fs = require('fs')
const path = require('path')
const pkg = require('./package')
const async = require('async')
const glob = require('multi-glob').glob
const xml = require('xml2js').Parser()
const rimraf = require('rimraf')
const sort = require('sort-object')

var dats = {
	'Sega - Saturn': {
		files: [
			'input/redump/redump/dats/Sega - Saturn*',
			'input/tosec/TOSEC-ISO/Sega Saturn*',
			'input/trurip/Sega Saturn*'
		]
	},
	'Sega - Dreamcast': {
		files: [
			'input/redump/redump/dats/Sega - Dreamcast*',
			'input/tosec/TOSEC-ISO/Sega Dreamcast*',
			'input/trurip/Sega Dreamcast*'
		]
	},
	'NEC - PC Engine CD - TurboGrafx-CD': {
		files: [
			'input/redump/redump/dats/NEC - PC Engine CD*',
			'input/tosec/TOSEC-ISO/NEC PC-Engine CD*',
			'input/trurip/NEC PC Engine CD*'
		]
	},
	'Sega - Mega-CD - Sega CD': {
		files: [
			'input/redump/redump/dats/Sega - Mega-CD*',
			'input/tosec/TOSEC-ISO/Sega Mega-CD*',
			'input/trurip/Sega Mega-CD*'
		]
	},
	'Sony - PlayStation': {
		files: [
			'input/redump/redump/dats/Sony - PlayStation (*',
			'input/tosec/TOSEC-ISO/Sony PlayStation -*',
			'input/trurip/Sony PlayStation & PSone*'
		]
	}
}

rimraf('dat', function () {
	fs.mkdir('dat', function () {
		async.mapValues(dats, processDat, function (err, results) {
			if (err)
				throw err
		})
	})
})

function processDat(datsInfo, name, done) {
	glob(datsInfo.files, function (err, files) {
		async.map(files, processXml, function (err, results) {
			if (err) {
				done(err)
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

			fs.writeFile(`dat/${name}.dat`, output, done)
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
