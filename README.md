# libretro-dats

Builds a set of DATs for [libretro-database](http://github.com/libretro/libretro-database).

## Features

Builds the following sources...

- Redump
- No-Intro
- TOSEC

## Dependencies

- Node.js 22.12 or newer
- `unzip`
- [Playwright CLI](https://playwright.dev/agent-cli/introduction), to download
  No-Intro and TOSEC: `npm install -g @playwright/cli@latest`

## Usage

1. Clone the repository...
    ``` bash
    git clone https://github.com/RobLoach/libretro-dats.git
    cd libretro-dats
    git submodule update --init
    npm install
    ```

1. Download the No-Intro and TOSEC packs into `input/downloads/`...
    ``` bash
    bash .claude/skills/input-dats/scripts/download-input.sh
    ```

    This fetches the No-Intro daily pack, with Aftermarket included, from
    https://datomatic.no-intro.org/?page=download&op=daily and the newest
    complete DAT pack from https://www.tosecdev.org/downloads. Packs downloaded
    by hand from those pages work just as well.

1. Extract them, and check they landed where `dats.json` expects...
    ``` bash
    bash .claude/skills/input-dats/scripts/extract-input.sh input/downloads/*.zip
    ```

    The packs carry their own top-level folder, so the datfiles end up at
    paths like these:
    ```
    input/no-intro/No-Intro/Nintendo - Nintendo Entertainment System*.dat
    input/tosec/TOSEC/Sony PlayStation*.dat
    ```

1. Run the script, which also fetches Redump...
    ``` bash
    npm start
    ```

    The built DATs are written into the `database` submodule, and a summary of
    which ones were built, and which were skipped for want of input files, is
    printed at the end of the run.

### Options

- `--skip-download` builds from the input files already on disk, without
  fetching anything. A source being unreachable no longer stops the DATs whose
  input is already in place from rebuilding, so this is mostly for working
  offline.
- `--force-download` fetches the sources again, instead of reusing what an
  earlier run downloaded.

``` bash
npm start -- --skip-download
```

## Configuration

`dats.json` maps each DAT that gets built to the input files it is built from:

``` json
"database/metadat/redump/Atari - Jaguar CD": {
    "files": [
        "input/redump/ajcd/Atari - Jaguar CD*.dat"
    ]
}
```

Adding a `disabled` property turns an entry off without losing its file
patterns, and the reason is printed in the run summary:

``` json
"database/metadat/tosec/Sega - Saturn": {
    "files": [
        "input/tosec/TOSEC-ISO/Sega Saturn - Ga*"
    ],
    "disabled": "TOSEC-ISO was dropped as a source"
}
```

The Redump systems that get downloaded are taken from these patterns, so a new
Redump DAT only needs an entry here.

## Tests

``` bash
npm test
```

`test/fixtures` holds a small corpus of real titles from each source, with the
DAT each one is expected to build checked in beside it. Title handling is easy
to get subtly wrong across the board while every hand-written case still
passes, so a change there shows up as a diff against the expected output. When
a change is meant to alter the output, rebuild the expected files and review
the diff it leaves behind:

``` bash
UPDATE_GOLDEN=1 npm test
git diff test/fixtures
```
