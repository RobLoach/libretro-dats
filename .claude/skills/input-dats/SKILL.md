---
name: input-dats
description: Download the No-Intro, TOSEC and Redump source datfiles and put them where the build expects them. Use when the input/ tree is missing or stale, when a build reports "No input files found", when asked to refresh or update the source DATs, or when setting this repository up for the first time.
---

# Getting the source DATs in place

`npm start` builds 137 DATs out of three upstream sources. Redump is fetched
automatically; No-Intro and TOSEC have to be downloaded by hand, because
No-Intro's download is a two-step browser form and TOSEC's link carries an
attachment id that changes with every release.

Everything under `input/` is gitignored, so none of this is ever committed.

## The layout that matters

The single most common mistake is extracting a pack one directory too high.
**The archives already contain their own top-level folder**, so they are
extracted into the *parent*:

| Source | Extract into | What has to exist afterwards | Patterns |
|---|---|---|---|
| No-Intro | `input/no-intro/` | `input/no-intro/No-Intro/` | 115 |
| No-Intro | — | `input/no-intro/Unofficial/` | 5 |
| TOSEC | `input/tosec/` | `input/tosec/TOSEC/` | 40 |
| TOSEC | — | `input/tosec/TOSEC-ISO/` | 10, all disabled |
| Redump | fetched by `npm start` | `input/redump/<system>/` | 21 |

Note the doubled directory: the No-Intro pack goes into `input/no-intro/` and
produces `input/no-intro/No-Intro/`. Dropping the datfiles straight into
`input/no-intro/` matches **nothing** — the README's example path is wrong
about this, so do not follow it.

## Steps

### 1. Download the packs

- **No-Intro** — <https://datomatic.no-intro.org/?page=download&op=daily>.
  Toggle **Pirate, Homebrew, Aftermarket** on, then work through the two-step
  form: **Request**, wait for it to be prepared, then **Download**. This cannot
  be scripted reliably; the form has changed before and broke the automation
  (issue #34), which is why `nointro()` is commented out in `download.js`.
- **TOSEC** — <https://www.tosecdev.org/downloads>. Take the complete DAT pack
  for the newest release. The URL in `download.js` pins a dated category and
  attachment id and will be stale.
- **Redump** — nothing to do. `npm start` fetches the 21 systems that
  `dats.json` actually reads, and skips any zip already on disk.

Ask the user to download these rather than guessing at a URL; both sites gate
downloads behind forms, and fetching the wrong artefact wastes a large
download.

### 2. Extract them

```bash
bash .claude/skills/input-dats/scripts/extract-input.sh ~/Downloads/*.zip
```

Identifies each archive by what it carries at its top level, extracts it into
the right parent, and verifies the result. Pass the packs in any order and
under whatever name the browser saved them as.

It uses the system `unzip` rather than the project's `extract-zip`, which fails
on the TOSEC pack (issue #63).

Re-extracting overwrites in place. That matters because datfiles carry their
release date in the filename, so a stale copy left behind gets matched by the
same glob as the new one and its entries silently overwrite the newer ones. If
a pack has been replaced rather than updated, clear the directory first:

```bash
rm -rf input/tosec && bash .claude/skills/input-dats/scripts/extract-input.sh <zip>
```

### 3. Verify before building

```bash
node .claude/skills/input-dats/scripts/verify-input.js
```

Resolves every pattern the build would resolve, grouped by source, and exits
non-zero when a source looks misplaced. A healthy tree reports:

```
input/no-intro/    partial    117 of 120 patterns matched, 148 files
input/redump/      ready      21 of 21 patterns matched, 21 files
input/tosec/       partial    39 of 40 patterns matched, 188 files
static/            ready      2 of 2 patterns matched, 2 files
```

A misplaced pack reports `MISPLACED only 5 of 120 patterns matched` and names
the directory that should have existed. Checking this first is much cheaper
than a build: the glob sweep takes seconds, a full build takes about 90.

`partial` is normal — a pack does not always carry every system. Two DATs
having no input is the expected state with current packs, and the build reports
them rather than failing.

### 4. Build

```bash
npm start -- --skip-download     # build from what is on disk, fetch nothing
npm start                        # also fetch Redump
npm start -- --force-download    # refetch Redump, ignoring cached zips
```

A full build takes roughly 90 seconds and writes into the `database`
submodule, so `git submodule update --init` has to have been run. Only DATs
whose contents actually changed are rewritten, so the summary line is the
quickest read on what a refresh did:

```
Built 135 of 137 DATs.
20 changed, 115 already up to date.
```

## Troubleshooting

- **"No DATs were built. Are the input files in place?"** — nothing matched at
  all. Run the verify script; the packs are almost certainly one level too
  high.
- **A source reports `MISPLACED`** — extract into the parent, per the table
  above.
- **Everything is `ready` but a system is missing** — that system is not in
  this pack. Confirm with `grep -i '<system>' dats.json` that it is configured,
  and check whether its `files` pattern still matches what the source names the
  file now.
- **A DAT reports `DISABLED`** — turned off on purpose in `dats.json`, with the
  reason printed beside it. The 10 TOSEC-ISO entries are off; extracting
  TOSEC-ISO will not switch them back on.
- **`FAILED <name>`** — one source file is malformed. The build carries on and
  exits non-zero; the message names the file.

## Rules

- Never commit anything under `input/`. It is gitignored, and the packs are
  hundreds of megabytes.
- Never guess a download URL for No-Intro or TOSEC. Both are behind forms, and
  the hardcoded URLs in `download.js` are already stale.
- Do not delete `static/`. Those two datfiles are checked in, hand-curated, and
  not downloadable from anywhere.
- Re-run the verify script after extracting anything, before building.
