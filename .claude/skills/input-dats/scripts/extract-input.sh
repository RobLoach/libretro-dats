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
	mkdir -p "$dest"

	# -o overwrites, so re-extracting a newer pack refreshes in place. Datfiles
	# are dated in their filenames, so stale ones would otherwise pile up and
	# both get matched by the globs.
	unzip -q -o "$zip" -d "$dest"

	count="$(find "$dest" -type f -name '*.dat' | wc -l)"
	echo "      $count .dat files now under $(basename "$dest")/"
done

echo
echo "Verifying the layout..."
node "$repo/.claude/skills/input-dats/scripts/verify-input.js" || status=$?

exit "$status"
