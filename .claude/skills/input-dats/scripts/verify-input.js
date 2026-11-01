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
				sources.set(source, {patterns: 0, matched: 0, files: 0})
			}
			const stats = sources.get(source)
			stats.patterns++

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
	for (const source of [...sources.keys()].sort()) {
		const {patterns, matched, files} = sources.get(source)
		const label = `${source}/`.padEnd(18)
		// A source pack is all-or-nothing, so most of its patterns should match
		// once it is in place. Well under half means it landed at the wrong
		// depth rather than that the pack is short of a few systems.
		if (matched * 2 < patterns) {
			broken++
			console.log(`${label} MISPLACED  only ${matched} of ${patterns} patterns matched`)
			console.log(`${' '.repeat(18)}            expected ${layout[source] || 'files here'}`)
		}
		else if (matched < patterns) {
			console.log(`${label} partial    ${matched} of ${patterns} patterns matched, ${files} files`)
		}
		else {
			console.log(`${label} ready      ${matched} of ${patterns} patterns matched, ${files} files`)
		}
	}

	if (emptyDats.length > 0) {
		console.log(`\n${emptyDats.length} enabled DATs have no input and would be skipped:`)
		for (const name of emptyDats) {
			console.log(`\t${name}`)
		}
		console.log('\nA handful of these is normal: a source pack does not always carry')
		console.log('every system, and the build reports them rather than failing.')
	}

	if (broken > 0) {
		console.log(`\n${broken} source(s) look misplaced. Extract the pack into the parent`)
		console.log('directory so that the folder inside the archive lands in place:')
		console.log('\n\tbash .claude/skills/input-dats/scripts/extract-input.sh <zip>')
		process.exitCode = 1
		return
	}

	console.log(`\n${enabled - emptyDats.length} of ${enabled} DATs have input. Ready to build:`)
	console.log('\tnpm start -- --skip-download')
}

main().catch(function (err) {
	console.error(err)
	process.exitCode = 1
})
