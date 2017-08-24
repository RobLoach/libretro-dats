# libretro-dats

Builds a set of DATs for [libretro-database](http://github.com/libretro/libretro-database).

## Sources

- [No-Intro](http://datomatic.no-intro.org/)
- [Redump](http://redump.org/)
- [Trurip](http://trurip.org/)
- [TOSEC](http://www.tosecdev.org/)
- [Darkwater](http://darkwater.info)
- [AdvanceSCENE](http://www.advanscene.com)
- [AtariMania](http://www.atarimania.com/)

## Usage

1. Install dependencies
    - Node.js
    - unzip
    - make
    - wget

2. Download the DATs
    - [Trurip](http://database.trurip.org/index.php?page=mnu-Database-DAT-List&mode=normal), only Games
    - Redump
    - TOSEC
    - No-Intro
    - Advance Scene

3. Verify the DATs are in the correct place
    ```
    input/no-intro/*
    input/advancescene/*
    input/tosec/TOSEC-ISO/*
    input/trurip/NEC - PC Engine CD*
    input/redump/dats/NEC - PC Engine CD
    input/b2071988/*
    ```

2. Build the DATs by running:
    ```
    make
    npm install
    npm test
    ```
