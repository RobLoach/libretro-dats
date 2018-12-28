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
    - Advance Scene

3. Verify the DATs are in the correct place
    ```
    input/no-intro/*
    input/advancescene/*
    input/tosec/TOSEC-ISO/*
    input/redump/dats/NEC - PC Engine CD
    input/b2071988/*
    ```

2. Build the DATs by running:
    ```
    make
    npm install
    npm test
    ```
