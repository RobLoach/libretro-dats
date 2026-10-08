#!/usr/bin/env bash
#
# Extract a downloaded source pack into the directory dats.json expects.
#
# The source is detected from what the archive carries at its top level, so the
# packs can be handed over in any order and under whatever name the browser
# saved them as.
#
# Usage: extract-input.sh <zip> [<zip> ...]
#
# Exit codes:
#   0  every archive was extracted
#   1  an archive was unreadable, or its source could not be identified
#   2  unzip is not installed, or the repository could not be located
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

if [ ! -f "$repo/dats.json" ]; then
	echo "Could not find dats.json in $repo" >&2
	exit 2
fi

if ! command -v unzip > /dev/null; then
	echo "unzip is required. Install it with: sudo apt install unzip" >&2
	exit 2
fi

if [ "$#" -eq 0 ]; then
	echo "Usage: extract-input.sh <zip> [<zip> ...]" >&2
	exit 1
fi

status=0

# The destinations already replaced by a pack in this run.
declare -A replaced=()

for zip in "$@"; do
	if [ ! -f "$zip" ]; then
		echo "SKIP  $zip: no such file" >&2
		status=1
		continue
	fi

	if ! listing="$(unzip -Z1 "$zip" 2> /dev/null)"; then
		echo "SKIP  $zip: not readable as a zip archive" >&2
		status=1
		continue
	fi

	# The No-Intro daily pack carries No-Intro/, Unofficial/ and friends; the
	# TOSEC pack carries TOSEC/ and TOSEC-ISO/. Both go into the parent, so the
	# directory inside the archive lands where the patterns look for it.
	if grep -qE '^No-Intro/' <<< "$listing"; then
		dest="$repo/input/no-intro"
		source="No-Intro"
	elif grep -qE '^TOSEC(-ISO)?/' <<< "$listing"; then
		dest="$repo/input/tosec"
		source="TOSEC"
	else
		echo "SKIP  $zip: no No-Intro/ or TOSEC/ directory inside, so the source is unclear" >&2
		echo "      top level: $(cut -d/ -f1 <<< "$listing" | sort -u | head -5 | paste -sd' ')" >&2
		status=1
		continue
	fi

	echo "$source  $zip"
	echo "      -> $dest"

	# The pack replaces whatever an earlier one left, rather than landing on
	# top of it. Datfiles carry their date in the filename, so last release's
	# would otherwise sit beside the new one and both match the same pattern.
	# It is extracted aside first, so a pack that fails leaves the old in place.
	# A second pack for the same source in one run goes on top of the first.
	if [ -n "${replaced[$dest]:-}" ]; then
		target="$dest"
	else
		target="$dest.part"
		rm -rf "$target"
	fi
	mkdir -p "$target"

	# unzip exits 1 on a warning it recovered from. The TOSEC pack carries one:
	# a CUE file whose name is encoded differently in its two zip headers.
	result=0
	unzip -q -o "$zip" -d "$target" || result=$?
	if [ "$result" -gt 1 ]; then
		echo "FAILED $zip: unzip could not extract it, so $(basename "$dest")/ was left as it was" >&2
		rm -rf "$dest.part"
		status=1
		continue
	fi

	if [ "$target" != "$dest" ]; then
		rm -rf "$dest"
		mv "$target" "$dest"
		replaced[$dest]=1
	fi

	count="$(find "$dest" -type f -name '*.dat' | wc -l)"
	echo "      $count .dat files now under $(basename "$dest")/"
done

echo
echo "Verifying the layout..."
node "$repo/.claude/skills/input-dats/scripts/verify-input.js" || status=$?

exit "$status"
