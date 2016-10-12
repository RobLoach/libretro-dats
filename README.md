# libretro-dats

Builds a set of DATs for [libretro-database](http://github.com/libretro/libretro-database) from [Redump](http://redump.org/), [Trurip](http://trurip.org/), [TOSEC](http://www.tosecdev.org/), [Darkwater](http://darkwater.info), [AdvanceSCENE](http://www.advanscene.com), and [AtariMania](http://www.atarimania.com/) sources.

- Atari - 2600
- NEC - PC Engine CD - TurboGrafx-CD
- NEC - PC-FX
- Nintendo - GameCube
- Sega - Saturn
- Sega - Dreamcast
- Sega - Mega-CD - Sega CD
- Sony - PlayStation
- Sony - PlayStation Portable
- Sinclair - ZX Spectrum
- The 3DO Company - 3DO

## Usage

1. Install dependencies

  - Node.js
  - unzip
  - make
  - wget

2. Build the DATs by running:
  ```
  make
  npm install
  npm test
  ```
