---
name: input-dats
description: Download the No-Intro, TOSEC and Redump source datfiles and put them where the build expects them. Use when the input/ tree is missing or stale, when a build reports "No input files found", when asked to refresh or update the source DATs, or when setting this repository up for the first time.
---

# Getting the source DATs in place

`npm start` builds 137 DATs out of three upstream sources. Redump is fetched by
the build itself. No-Intro and TOSEC are fetched with
[Playwright CLI](https://playwright.dev/agent-cli/introduction), because
neither has a fixed URL: No-Intro prepares its pack on request through a
two-step form, and TOSEC files every release under a new dated category with
its own attachment id.

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
`input/no-intro/` matches **nothing**.

## Steps

### 1. Download the packs

```bash
bash .claude/skills/input-dats/scripts/download-input.sh          # both packs
bash .claude/skills/input-dats/scripts/download-input.sh tosec    # just one
```

Drives `playwright-cli` through both sites and saves the packs into
`input/downloads/` under the names the sites give them, which carry the release
date. Only the newest pack of each source is kept there. A run takes about 30
seconds. It needs `playwright-cli` on the PATH:

```bash
npm install -g @playwright/cli@latest
```

What it does on each site, so a run that fails can be finished by hand:

- **No-Intro** — opens
  <https://datomatic.no-intro.org/index.php?page=download&op=daily>, ticks the
  `set[1]` (No-Intro), `set[3]` (Unofficial), `include_standard` and
  `include_aftermarket` boxes, clicks **Request**, then clicks **Download!!** on
  the page that follows. That page carries several Download!! buttons, all but
  one of them hidden to catch scripts. The script targets it with
  `getByRole('button', { name: 'Download!!' })`, which only matches what is
  visible and fails rather than guesses if that is ever more than one.
- **TOSEC** — opens <https://www.tosecdev.org/downloads>, picks the newest dated
  release (the menu is not in date order), and clicks its "DAT Pack - Complete"
  link.
- **Redump** — nothing to do. `npm start` fetches the 21 systems that
  `dats.json` actually reads. A system downloaded less than a day ago is
  reused; anything older is fetched again and replaces what was there.

If a site has changed, the script prints `FAILED <source>` with the
playwright-cli error for the step that broke. Walk that site by hand and look
at the page before changing anything:

```bash
playwright-cli -s=dats open 'https://datomatic.no-intro.org/index.php?page=download&op=daily'
playwright-cli -s=dats snapshot
playwright-cli -s=dats close
```

Then update `download-input.sh` to match. Packs downloaded by hand in a browser
work too; pass their paths to the extract step instead.

### 2. Extract them

```bash
bash .claude/skills/input-dats/scripts/extract-input.sh input/downloads/*.zip
```

Identifies each archive by what it carries at its top level, extracts it into
the right parent, and verifies the result. Pass the packs in any order and
under any name.

It uses the system `unzip` rather than the project's `extract-zip`, which fails
on the TOSEC pack (issue #63).

Each pack replaces the directory an earlier one left, rather than landing on
top of it. Datfiles carry their release date in the filename, so last
release's copy would otherwise sit beside the new one and both would match the
same glob. The pack is extracted aside first, so one that fails to extract
leaves the previous tree in place.

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
npm start                        # also fetch Redump older than a day
npm start -- --force-download    # refetch all of Redump, however recent
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

- **`download-input.sh` reports `FAILED No-Intro` or `FAILED TOSEC`** — the
  site changed. Walk it by hand with `playwright-cli snapshot`, per step 1.
- **`playwright-cli is required`** — install it with
  `npm install -g @playwright/cli@latest`.
- **unzip warns of a mismatching "local" filename** — one CUE file in the TOSEC
  pack has its name encoded two ways. That is upstream and harmless; the
  extract script carries on.
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
- **`FAILED <name>`** from the build — one source file is malformed. The build
  carries on and exits non-zero; the message names the file.

## Rules

- Never commit anything under `input/`. It is gitignored, and the packs are
  hundreds of megabytes.
- Never hardcode a No-Intro or TOSEC download URL. The No-Intro pack only
  exists once requested, and the TOSEC link changes with every release, so the
  script finds both from the pages each time.
- On No-Intro's download page, only ever click what is visible. The hidden
  Download!! buttons are there to catch scripts.
- Do not delete `static/`. Those two datfiles are checked in, hand-curated, and
  not downloadable from anywhere.
- Re-run the verify script after extracting anything, before building.
