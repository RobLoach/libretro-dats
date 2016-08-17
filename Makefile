default: nointro redump tosec trurip

clean:
	rm -rf out

out/sources/nointro:
	mkdir -p out/sources/nointro

out/sources/nointro.zip: out/sources/nointro
	-wget --no-clobber --output-document=out/sources/nointro.zip --referer=http://www.emulab.it/rommanager/datfiles.php?category=14 http://www.emulab.it/rommanager/getfile.php?id=ff6ff228edc7b39b7716c4e4ded91694

nointro: out/sources/nointro.zip
	unzip -u out/sources/nointro.zip -d out/sources/nointro

out/sources/redump:
	mkdir -p out/sources/redump

out/sources/redump.zip: out/sources/redump
	-wget --no-clobber --output-document=out/sources/redump.zip --referer=http://www.emulab.it/rommanager/datfiles.php?category=15 http://www.emulab.it/rommanager/getfile.php?id=4d21495167d87592f2ca189eacf7bc93

redump: out/sources/redump.zip
	unzip -u out/sources/redump.zip -d out/sources/redump

out/sources/tosec:
	mkdir -p out/sources/tosec

out/sources/tosec.zip: out/sources/tosec
	-wget --no-clobber --output-document=out/sources/tosec.zip --referer=http://www.tosecdev.org/downloads/category/37-2016-07-02?download=73:tosec-dat-pack-complete-2313-tosec-v2016-07-02 http://www.tosecdev.org/downloads/category/37-2016-07-02?download=73:tosec-dat-pack-complete-2313-tosec-v2016-07-02

tosec: out/sources/tosec.zip
	unzip -u out/sources/tosec.zip -d out/sources/tosec

out/sources/trurip:
	mkdir -p out/sources/trurip

out/sources/trurip.zip: out/sources/trurip
	-wget --no-clobber --output-document=out/sources/trurip.zip --referer=https://github.com/RobLoach/libretro-dats/releases/tag/tr-2016.08.17 https://github.com/RobLoach/libretro-dats/releases/download/tr-2016.08.17/tr.zip

trurip: out/sources/trurip.zip
	unzip -u out/sources/trurip.zip -d out/sources/trurip
