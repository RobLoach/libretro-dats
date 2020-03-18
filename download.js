const mkdirp = require('mkdirp')
const extract = require('extract-zip')
const fs = require('fs')
const request = require('request')

module.exports = async function download() {
	await nointro()
	await tosec()
	mkdirp.sync('input/redump')
	await redump()
}

function tosec() {
	return new Promise(function(resolve, reject) {
		if (fs.existsSync('tosec.zip')) {
			if (!fs.existsSync('input/tosec')) {
				extractFile('tosec.zip', 'input/tosec').then(resolve, reject).catch(reject)
			}
			else {
				resolve();
			}
		} else {
			console.log('Downloading TOSEC')
			request.post('https://www.tosecdev.org/downloads/category/48-2019-12-24?download=95:tosec-dat-pack-complete-3012-tosec-v2019-12-24')
			.on('error', function(err) {
				reject(err)
			})
			.on('finish', function(err) {
				if (err) {
					return reject(err)
				} else {
					setTimeout(function() {
						extractFile('tosec.zip', 'input/tosec').then(resolve, reject).catch(reject)
					}, 500)
				}
			})
			.pipe(fs.createWriteStream('tosec.zip'))
		}
	})
}

function nointro() {
	return new Promise(function(resolve, reject) {
		if (fs.existsSync('nointro.zip')) {
			if (!fs.existsSync('input/no-intro')) {
				extractFile('nointro.zip', 'input/no-intro').then(resolve, reject).catch(reject)
			}
			else {
				resolve();
			}
		} else {
			reject('Download nointro.zip from https://datomatic.no-intro.org/?page=download&fun=daily');
			return

			// TODO: Fix No-Intro downloading
			/*console.log('Downloading No-Intro')
			request.post('https://datomatic.no-intro.org/?page=download&fun=daily', {
				form: {
					dat_type: 'standard',
					download: 'Download'
				}
			})
			.on('error', function(err) {
				reject(err)
			})
			.on('finish', function(err) {
				if (err) {
					reject(err)
				} else {
					setTimeout(function() {
						extractFile('nointro.zip', 'input/no-intro').then(resolve, reject).catch(reject)
					}, 500)
				}
			})
			.pipe(fs.createWriteStream('nointro.zip'))
			*/
		}
	})
}

function extractFile(source, dest) {
	console.log('extract ' + source)
	return new Promise(function(resolve, reject) {
		console.log('Extracting ' + source)
		const destDir = __dirname + '/' + dest
		mkdirp(destDir, function(err) {
			if (err) {
				reject(err)
			} else {
				extract(source, {dir: destDir}, function (err) {
					if (err) {
						reject(err)
					} else {
						resolve()
					}
				})
			}
		})
	})
}

async function redumpDownload(element) {
	await downloadFile(`http://redump.org/datfile/${element}/serial,version`, `input/redump/${element}.zip`)
}
async function redumpExtract(element) {
	await extractFile(`input/redump/${element}.zip`, 'input/redump')
}

async function redump() {
	console.log('redump!')
	const systems = [
		'mac',
		'pippin',
		'acd',
		'cd32',
		'cdtv',
		'fmt',
		'3do',
		'pc',
		'hs',
		'xbox',
		'pc-88',
		'pc-98',
		'pc-fx',
		'pce',
		'psp',
		'gc',
		'palm',
		'mcd',
		'3do',
		'cdi',
		'photo-cd',
		'dc',
		'ss',
		'ngcd',
		'psx',
		'ps2',
		'vflash',
		'triforce',
		'chihiro',
		'lindbergh',
		'naomi'
	]
	for (let element of systems) {
		console.log(element)
		await redumpDownload(element)
		//await downloadFile(`http://redump.org/datfile/${system}/`, `input/redump/${system}.zip`)
		//await extractFile(`input/redump/${system}.zip`, 'input/redump')
	}

	for (let element of systems) {
		console.log('download ', element)
		await redumpExtract(element)
	}

	/*
	systems.forEach(async (system) => {
		console.log(system)
		//await downloadFile(`http://redump.org/datfile/${system}/`, `input/redump/${system}.zip`)
		//await extractFile(`input/redump/${system}.zip`, 'input/redump')
		
	})*/


		//

	/*var promises = systems.map(redumpDownload)
	await Promise.all(promises)
	promises = systems.map(redumpExtract)
	await Promise.all(promises)*/

	/*
	for (var element of systems) {
		await downloadFile(`http://redump.org/datfile/${element}/`, `input/redump/${element}.zip`)
		await extractFile(`input/redump/${element}.zip`, 'input/redump')
	}*/
	/*systems.forEach(async function (element) {
		setTimeout(async function () {
			await extractFile(`input/redump/${element}.zip`, 'input/redump')
		}, 500)
	})*/
}

function downloadFile(url, dest) {
	console.log(url)
	return new Promise(function (resolve, reject) {
		const destDir = __dirname + '/' + dest
		if (!fs.existsSync(destDir)) {
			console.log('Downloading ' + url)
			request.get(url)
			.on('error', function(err) {
				console.error('Error on download ', url, dest)
				reject(err)
			})
			.on('finish', function(err) {
				if (err) {
					console.error('Failed finish to download ', url, dest)
					reject(err)
				} else {
					console.log('finished ', dest)
					resolve()
				}
			})
			.pipe(fs.createWriteStream(destDir))
			resolve();
		} else {
			resolve()
		}
	})
}
