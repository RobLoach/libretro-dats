const mkdirp = require('mkdirp')
const extract = require('extract-zip')
const fs = require('fs')
const request = require('request')
const path = require('path')
const download = require('download')

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
				mkdirp.sync('input/tosec')
				extractFile('tosec.zip', 'input/tosec').then(resolve, reject).catch(reject)
			}
			else {
				resolve();
			}
		} else {
			console.log('Downloading TOSEC')
			request.post('https://www.tosecdev.org/downloads/category/54-2021-12-31?download=107:tosec-dat-pack-complete-3312-tosec-v2021-12-31')
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
			reject('Download the standard No-Intro Love Pack from https://datomatic.no-intro.org/index.php?page=download&op=daily and rename it to nointro.zip');
			return

			// TODO: Fix No-Intro downloading
			/*console.log('Downloading No-Intro')
			request.post('https://datomatic.no-intro.org/index.php?page=download&op=daily', {
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
		mkdirp.sync(destDir)
		extract(source, {dir: destDir}, function (err) {
			if (err) {
				reject(err)
			} else {
				resolve()
			}
		})
	})
}

async function redumpDownload(element) {
	await downloadFile(`http://redump.org/datfile/${element}/serial,version`, `input/redump/${element}.zip`)
}

async function redump() {
	console.log('redump!')
	mkdirp.sync('input/redump')
	const systems = [
		'cdi',
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
		'trf',
		'chihiro',
		'lindbergh',
		'naomi',
		'naomi2'
	]
	for (let element of systems) {
		console.log(element)
		await redumpDownload(element)
		//await downloadFile(`http://redump.org/datfile/${system}/`, `input/redump/${system}.zip`)
		//await extractFile(`input/redump/${system}.zip`, 'input/redump')
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

async function downloadFile(url, dest) {
	const destDir = __dirname + '/' + dest
	const finalDir = path.dirname(destDir)
	if (!fs.existsSync(finalDir)) {
		fs.mkdirSync(finalDir);
	}
	await download(url, finalDir, {
		extract: true
	})
}

function downloadFile2(url, dest) {
	return new Promise(function (resolve, reject) {
		const destDir = __dirname + '/' + dest
		if (!fs.existsSync(destDir)) {
			console.log('Downloading ' + url)

			fetch(url)

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
