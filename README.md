# libretro-dats

Builds a set of DATs for [libretro-database](http://github.com/libretro/libretro-database).

## Usage

1. Install dependencies
    - Node.js
    - unzip
    - make
    - wget

2. Download the DATs
    - Redump
    - TOSEC
    - No-Intro

3. Verify the DATs are in the correct place
    ```
    input/no-intro/*
    input/tosec/TOSEC-ISO/*
    input/redump/dats/NEC - PC Engine CD
    ```

2. Build the DATs by running:
    ```
    make
    npm install
    npm test
    ```
