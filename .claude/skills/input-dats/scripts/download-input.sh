#!/usr/bin/env bash
#
# Download the No-Intro daily pack and the newest TOSEC DAT pack with
# Playwright CLI.
#
# Neither is a fixed URL. No-Intro prepares its pack on request through a
# two-step form, and TOSEC files every release under a new dated category with
# its own attachment id. playwright-cli walks both the way a person would.
#
# The packs land in input/downloads/ under the names the sites give them, which
# carry the release date. Hand them to extract-input.sh next.
#
# Usage: download-input.sh [no-intro] [tosec]
#
# Exit codes:
#   0  every requested pack was downloaded
#   1  a download failed, most likely because a site changed its pages
#   2  bad arguments, playwright-cli is missing, or no repository found
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

if [ ! -f "$repo/dats.json" ]; then
	echo "Could not find dats.json in $repo" >&2
	exit 2
fi

if ! command -v playwright-cli > /dev/null; then
	echo "playwright-cli is required. Install it with: npm install -g @playwright/cli@latest" >&2
	exit 2
fi

sources=("$@")
if [ "${#sources[@]}" -eq 0 ]; then
	sources=(no-intro tosec)
fi
for source in "${sources[@]}"; do
	case "$source" in
		no-intro|tosec) ;;
		*)
			echo "Usage: download-input.sh [no-intro] [tosec]" >&2
			exit 2
			;;
	esac
done

# How long a single pack may take to arrive. Both are around 100 MB.
timeout_ms=$((10 * 60 * 1000))

session="input-dats"
downloads="$repo/input/downloads"
mkdir -p "$downloads"

# playwright-cli leaves snapshots and logs wherever it runs, and saves
# downloads relative to there, so work in a scratch directory cleared after.
work="$(mktemp -d "$downloads/.work-XXXXXX")"
cleanup() {
	playwright-cli -s="$session" close > /dev/null 2>&1 || true
	rm -rf "$work"
}
trap cleanup EXIT
cd "$work"

# Run a playwright-cli command in this session. Its output is only shown when
# it fails, as that carries the error.
pw() {
	local output
	if ! output="$(playwright-cli -s="$session" "$@" 2>&1)"; then
		sed 's/^/      /' <<< "$output" >&2
		return 1
	fi
	printf '%s' "$output"
}

# Click the element a locator names, and save the download it starts.
save_download() {
	pw run-code "async page => {
		const download = page.waitForEvent('download', { timeout: $timeout_ms })
		await page.$1.click()
		const file = await download
		await file.saveAs(file.suggestedFilename())
	}" > /dev/null
}

nointro() {
	pw open 'https://datomatic.no-intro.org/index.php?page=download&op=daily' > /dev/null || return 1

	# The options dats.json draws on: the No-Intro and Unofficial sets, and the
	# Aftermarket datfiles beside the standard ones. The boxes carry no labels,
	# so they are found by name. Each one resubmits the form when it changes.
	local option
	for option in 'set[1]' 'set[3]' include_standard include_aftermarket; do
		pw check "form[name=daily] input[name='$option']" > /dev/null || return 1
	done

	pw click "getByRole('button', { name: 'Request' })" > /dev/null || return 1

	# The prepared pack sits behind several buttons labelled Download!!, all but
	# one of them hidden to catch scripts. A role locator only matches what a
	# person can see, and fails rather than guesses if that is ever two.
	save_download "getByRole('button', { name: 'Download!!' })"
}

tosec() {
	pw open 'https://www.tosecdev.org/downloads' > /dev/null || return 1

	# Each release is a category named for its date. The menu does not list
	# them in date order, so pick the newest by name.
	local release
	release="$(pw --raw eval "[...document.querySelectorAll('a[href*=\"/downloads/category/\"]')]
		.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.textContent.trim()))
		.sort((a, b) => b.textContent.trim().localeCompare(a.textContent.trim()))[0]?.href ?? ''")" || return 1
	release="${release//\"/}"
	if [ -z "$release" ]; then
		echo "      Found no dated releases on the downloads page" >&2
		return 1
	fi
	# The category is named like 59-2025-03-13, the id ahead of the date.
	local category="${release##*/}"
	echo "      newest release is ${category#*-}"
	pw goto "$release" > /dev/null || return 1

	save_download "getByRole('link', { name: /DAT Pack - Complete .*\\.zip\$/ })"
}

status=0

for source in "${sources[@]}"; do
	case "$source" in
		no-intro) name="No-Intro" fetch=nointro ;;
		tosec) name="TOSEC" fetch=tosec ;;
	esac
	echo "$name"

	if ! "$fetch"; then
		echo "FAILED $name" >&2
		status=1
		continue
	fi

	zip="$(find "$work" -maxdepth 1 -name '*.zip' -print -quit)"
	if [ -z "$zip" ]; then
		echo "FAILED $name: the browser saved no zip" >&2
		status=1
		continue
	fi

	# Only one pack per source is kept, so extracting input/downloads/*.zip
	# never lays an old pack over a new one.
	find "$downloads" -maxdepth 1 -name "$name*.zip" -delete
	mv "$zip" "$downloads/"
	echo "      -> input/downloads/$(basename "$zip") ($(du -m "$downloads/$(basename "$zip")" | cut -f1) MB)"
done

if [ "$status" -eq 0 ]; then
	echo
	echo "Next, extract them:"
	echo
	echo "	bash .claude/skills/input-dats/scripts/extract-input.sh input/downloads/*.zip"
fi

exit "$status"
