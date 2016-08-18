default: nointro redump tosec trurip

clean:
	rm -rf input

input/nointro:
	mkdir -p input/nointro

input/nointro.zip: input/nointro
	-wget --no-clobber --output-document=input/nointro.zip --referer=http://www.emulab.it/rommanager/datfiles.php?category=14 http://www.emulab.it/rommanager/getfile.php?id=ff6ff228edc7b39b7716c4e4ded91694

nointro: input/nointro.zip
	unzip -u input/nointro.zip -d input/nointro

input/redump:
	mkdir -p input/redump

input/redump.zip: input/redump
	-wget --no-clobber --output-document=input/redump.zip --referer=http://www.emulab.it/rommanager/datfiles.php?category=15 http://www.emulab.it/rommanager/getfile.php?id=4d21495167d87592f2ca189eacf7bc93

redump: input/redump.zip
	unzip -u input/redump.zip -d input/redump

input/tosec:
	mkdir -p input/tosec

input/tosec.zip: input/tosec
	-wget --no-clobber --output-document=input/tosec.zip --referer=http://www.tosecdev.org/downloads/category/37-2016-07-02?download=73:tosec-dat-pack-complete-2313-tosec-v2016-07-02 http://www.tosecdev.org/downloads/category/37-2016-07-02?download=73:tosec-dat-pack-complete-2313-tosec-v2016-07-02

tosec: input/tosec.zip
	unzip -u input/tosec.zip -d input/tosec

input/trurip:
	mkdir -p input/trurip

input/trurip.zip: input/trurip
	-wget --no-clobber --output-document=input/trurip.zip --referer=https://github.com/RobLoach/libretro-dats/releases/tag/tr-2016.08.17 https://github.com/RobLoach/libretro-dats/releases/download/tr-2016.08.17/tr.zip

trurip: input/trurip.zip
	unzip -u input/trurip.zip -d input/trurip
