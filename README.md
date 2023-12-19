# libretro-dats

Builds a set of DATs for [libretro-database](http://github.com/libretro/libretro-database).

## Features

Builds the following sources...

- Redump
- No-Intro
- TOSEC

## Dependencies

- Node.js

## Usage

1. Download the source dat files from...
    - https://datomatic.no-intro.org/?page=download&op=daily
    - https://www.tosecdev.org/downloads

1. Extract them and set up the .dat files to match...
    ```
    input/no-intro/Nintendo - Nintendo Entertainment System*.dat
    input/tosec/TOSEC/Sony PlayStation*.dat
    ```

1. Run the script...
    ``` bash
    git clone https://github.com/RobLoach/libretro-dats.git
    cd libretro-dats
    git submodule update --init
    npm install
    npm test
    ```
