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

1. Download the No-Intro and TOSEC packs into `input/downloads/`.

1. Extract them, and check they landed where `dats.json` expects.
    ```
    input/no-intro/No-Intro/Nintendo - Nintendo Entertainment System*.dat
    input/tosec/TOSEC/Sony PlayStation*.dat
    ```

1. Run the script, which also fetches Redump...
    ``` bash
    npm start
    ```

### Options

- `--skip-download` builds from the input files already on disk, without
  fetching anything. A source being unreachable no longer stops the DATs whose
  input is already in place from rebuilding, so this is mostly for working
  offline.
- `--force-download` fetches the sources again, instead of reusing what an
  earlier run downloaded. Without it, a Redump system is reused for a day,
  then fetched again.

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

## Tests

``` bash
npm test
```
