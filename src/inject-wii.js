const ini = require('ini')
const glob = require('glob')
const fs = require('fs')
const stringSimilarity = require('string-similarity')

function serials() {
	if (!serials.data) {
		serials.data = {}

		console.log('ini file')
		const iniFiles = glob.sync('vendor/dolphin/Data/Sys/wiitdb-*.txt', {
			nodir: true,
			matchBase: true
		})
		for (let iniFile in iniFiles) {
			let contents = fs.readFileSync(iniFiles[iniFile], 'utf-8')
			let data = ini.parse(contents)
			for (serialNumber in data) {
				serials.data[serialNumber] = cleanSerial(data[serialNumber])
			}
		}
	}

	return serials.data
}

function cleanName(gameName) {
	// Match the Redump naming to the Dolphin names.
	let finalName = gameName.split('(')[0]
	finalName = finalName.replace(' - ', ': ')
		.replace(' & ', ' and ')
		.replace('Super Punch-Out!!', 'Punch-Out!!')
		.replace('Donkey Kong Country Returns', 'Donkey Kong Country')
		.replace('Legend of Zelda, The', 'The Legend of Zelda')
		.replace('III', '3')
		.replace(': Echoes of Time', '')
		.replace(': Smash-Up', '')
		.replace(' Tenkaichi', '')
		.replace(' - Lightsaber Duels', '')
		.replace(' - Into the Inferno', '')
	return finalName
}

function cleanSerial(serialName) {
	let finalName = serialName.replace(' Undub', '')
		.replace('足球', '')
		.replace(' Version! Latino Beta 3', '')
		.replace(' Version! Latino', '')
		.replace(' - ', ': ')
		.replace(' : ', ': ')
		.replace(' The Rise of Hex', '')
		.replace('The Gottlieb Collection', 'The Williams Collection')
		.replace('The Sands of Time', 'The Forgotten Sands')
		.replace('The Sims 2', 'Sims 2, The')
		.replace('Radian Dawn', 'Radiant Dawn')
		.replace(' + ', ' and ')
		.replace('Family Games', 'Big Family Games')

	let strictNames = {
		'Metroid': 'Metroid: Other M',
		'Metroid Prime': 'Metroid Prime Trilogy',
		'Super Monkey Ball': 'Super Monkey Ball: Banana Blitz',
		'Super Monkey Ball 2': 'Super Monkey Ball: Step and Roll',
		'Super Mario Kart Wii': 'Mario Kart Wii',
		'SoulCalibur II': 'Soulcalibur Legends',
		'Wave Race 64: Kawasaki Jet Ski': 'Kawasaki Jet Ski',
		'Tom Clancy\'s Splinter Cell': "Tom Clancy's Splinter Cell: Blacklist",
		'Naruto Clash of Ninja 2': 'Naruto: Clash of Ninja Revolution 2',
		'Animal Crossing': 'Animal Crossing: City Folk',
		'Need for Speed: Underground 2': 'Need for Speed: Carbon',
		'Need for Speed: Underground': 'Need for Speed: Undercover',
		'Super Smash Bros. 3': 'Super Smash Bros. Brawl',
		'Pitfall: The Mayan Adventure': 'Pitfall: The Big Adventure',
		'Tetris Party': 'Tetris Party Deluxe'
	}
	if (strictNames[finalName]) {
		finalName = strictNames[finalName]
	}

	return finalName
}

function doesNameMatch(gameName, serialName) {
	let name = cleanName(gameName)
	let similarity = stringSimilarity.compareTwoStrings(name, serialName)
	if (similarity > 0.7) {
		console.log('Similarity: ' + name)
		console.log('            ' + serialName)
		console.log('            ' + similarity)

	}
	return similarity >= 0.9
}

function injectSerialData(games) {

	let db = serials();

	for (let gameName in games) {
		// Skip if it already has a serial.
		if (!games[gameName].serial) {
			// Find if there is a matching serial.
			for (let serialNumber in db) {
				// Make sure the serial isn't already used.
				if (db[serialNumber]) {
					// See if the game names match.
					if (doesNameMatch(gameName, db[serialNumber])) {
						games[gameName].serial = serialNumber
						db[serialNumber] = null
						break
					}
				}
			}
		}
	}

	//console.log(db)
	return games
}

module.exports = injectSerialData