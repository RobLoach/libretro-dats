#!/usr/bin/env node
//
// Report whether the input files are where dats.json expects them.
//
// Resolves every pattern the build would resolve, grouped by source, so a pack
// extracted one directory too high shows up as a source with nothing matched
// rather than as 120 individually missing DATs.
//
// Usage: node .claude/skills/input-dats/scripts/verify-input.js
//
// A pack found elsewhere under input/, such as extracted by hand beside its
// zip in input/downloads/, is named along with the command that moves it.
// Redump not being fetched yet is not an error, since npm start fetches it.
//
// Exit codes:
//   0  every source matched something, and nothing is obviously misplaced
//   1  a source matched nothing at all, so it is missing or misplaced
//   2  run from the wrong directory

const fs = require('fs')
const path = require('path')

const repo = path.resolve(__dirname, '../../../..')
process.chdir(repo)

if (!fs.existsSync('dats.json')) {
	console.error(`Could not find dats.json in ${repo}`)
	process.exit(2)
}

const dats = require(path.join(repo, 'dats.json'))

/**
 * The source a pattern draws from, which is its first two path segments.
 */
function sourceOf(pattern) {
	const parts = pattern.split('/')
	return parts[0] === 'static' ? 'static' : parts.slice(0, 2).join('/')
}

// Where each source is expected to land, for the hint on a miss. The archives
// carry these directories themselves, so they are extracted into the parent.
const layout = {
	'input/no-intro': 'the No-Intro daily pack, extracted so that input/no-intro/No-Intro/ exists',
	'input/tosec': 'the TOSEC DAT pack, extracted so that input/tosec/TOSEC/ exists',
	'input/redump': 'fetched by npm start, one directory per system',
	'static': 'checked into the repository'
}

// Fetched by the build itself, so having none of it yet is expected.
const fetchedByBuild = 'input/redump'

/**
 * The top-level folder a pattern reads from inside its source, such as
 * "No-Intro" for input/no-intro/No-Intro/*.dat.
 */
function folderOf(pattern) {
	return pattern.split('/')[2]
}

/**
 * Directories under input/ named like one of the given folders, other than
 * where they belong. Looks a few levels deep, which covers a pack extracted
 * beside its zip in input/downloads/, or one level too high or too low.
 */
function findStray(source, folders, dir = 'input', depth = 0) {
	const found = []
	if (depth > 3 || dir === fetchedByBuild) {
		return found
	}
	let entries
	try {
		entries = fs.readdirSync(dir, {withFileTypes: true})
	}
	catch {
		return found
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue
		}
		const child = path.posix.join(dir, entry.name)
		if (folders.has(entry.name) && path.posix.dirname(child) !== source) {
			found.push(child)
		}
		else {
			found.push(...findStray(source, folders, child, depth + 1))
		}
	}
	return found
}

async function main() {
	const sources = new Map()
	const emptyDats = []
	let enabled = 0

	for (const [name, info] of Object.entries(dats)) {
		if (info.disabled) {
			continue
		}
		enabled++

		let found = 0
		for (const pattern of info.files) {
			const source = sourceOf(pattern)
			if (!sources.has(source)) {
				sources.set(source, {patterns: 0, matched: 0, files: 0, folders: new Set(), dats: new Set()})
			}
			const stats = sources.get(source)
			stats.patterns++
			stats.dats.add(name)
			if (folderOf(pattern)) {
				stats.folders.add(folderOf(pattern))
			}

			const matches = await Array.fromAsync(fs.promises.glob(pattern))
			if (matches.length > 0) {
				stats.matched++
				stats.files += matches.length
			}
			found += matches.length
		}

		if (found === 0) {
			emptyDats.push(name)
		}
	}

	console.log(`${enabled} DATs are enabled in dats.json.\n`)

	let broken = 0
	const moves = []
	let pending = null
	for (const source of [...sources.keys()].sort()) {
		const {patterns, matched, files, folders, dats} = sources.get(source)
		const label = `${source}/`.padEnd(18)
		// A source pack is all-or-nothing, so most of its patterns should match
		// once it is in place. Well under half means it landed at the wrong
		// depth rather than that the pack is short of a few systems.
		if (matched * 2 < patterns && source === fetchedByBuild) {
			pending = dats
			console.log(`${label} not yet    ${matched} of ${patterns} patterns matched, npm start fetches the rest`)
		}
		else if (matched * 2 < patterns) {
			broken++
			console.log(`${label} MISPLACED  only ${matched} of ${patterns} patterns matched`)
			console.log(`${' '.repeat(18)}            expected ${layout[source] || 'files here'}`)
			for (const stray of findStray(source, folders)) {
				console.log(`${' '.repeat(18)}            found ${stray}/ instead`)
				moves.push([stray, source])
			}
		}
		else if (matched < patterns) {
			console.log(`${label} partial    ${matched} of ${patterns} patterns matched, ${files} files`)
		}
		else {
			console.log(`${label} ready      ${matched} of ${patterns} patterns matched, ${files} files`)
		}
	}

	// DATs the build is about to fetch input for are not going to be skipped.
	const skipped = pending ? emptyDats.filter(name => !pending.has(name)) : emptyDats
	if (pending) {
		console.log(`\n${emptyDats.length - skipped.length} Redump DATs get their input when npm start fetches it.`)
	}

	if (skipped.length > 0) {
		console.log(`\n${skipped.length} enabled DATs have no input and would be skipped:`)
		for (const name of skipped) {
			console.log(`\t${name}`)
		}
		if (broken === 0) {
			console.log('\nA handful of these is normal: a source pack does not always carry')
			console.log('every system, and the build reports them rather than failing.')
		}
	}

	if (broken > 0) {
		if (moves.length > 0) {
			console.log(`\n${broken} source(s) look misplaced. Move what was found into place:\n`)
			for (const target of new Set(moves.map(([, source]) => source))) {
				console.log(`\tmkdir -p ${target}`)
			}
			for (const [stray, source] of moves) {
				console.log(`\tmv '${stray}' ${source}/`)
			}
			console.log('\nor re-extract the pack, which puts it in the right place:')
		}
		else {
			console.log(`\n${broken} source(s) look misplaced. Extract the pack into the parent`)
			console.log('directory so that the folder inside the archive lands in place:')
		}
		console.log('\n\tbash .claude/skills/input-dats/scripts/extract-input.sh <zip>')
		process.exitCode = 1
		return
	}

	if (pending) {
		console.log(`\n${enabled - skipped.length} of ${enabled} DATs will have input. Ready to build, fetching Redump:`)
		console.log('\tnpm start')
		return
	}

	console.log(`\n${enabled - skipped.length} of ${enabled} DATs have input. Ready to build:`)
	console.log('\tnpm start -- --skip-download')
}

main().catch(function (err) {
	console.error(err)
	process.exitCode = 1
})
