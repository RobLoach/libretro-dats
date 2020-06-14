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

To download and build the dats, use the following...

``` bash
git clone https://github.com/RobLoach/libretro-dats.git
cd libretro-dats
git submodule update --init
npm install
npm test
```

## Known Issues

- `nointro.zip` doesn't download properly currently. You can get it from https://datomatic.no-intro.org/?page=download&op=daily .
