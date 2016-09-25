default: nointro redump tosec trurip advancescene darkwater

clean:
	rm -rf input

input/nointro:
	mkdir -p input/nointro

input/nointro.zip: input/nointro
	-wget --no-clobber --output-document=input/nointro.zip \
		--referer=http://www.emulab.it/rommanager/datfiles.php?category=14 \
		http://www.emulab.it/rommanager/getfile.php?id=1573857e7efce16e796cea99e398b20c

nointro: input/nointro.zip
	unzip -u input/nointro.zip -d input/nointro

input/redump:
	mkdir -p input/redump

input/redump.zip: input/redump
	-wget --no-clobber --output-document=input/redump.zip \
		--referer=http://www.emulab.it/rommanager/datfiles.php?category=15 \
		http://www.emulab.it/rommanager/getfile.php?id=4d21495167d87592f2ca189eacf7bc93

redump: input/redump.zip
	unzip -u input/redump.zip -d input/redump

input/tosec:
	mkdir -p input/tosec

input/tosec.zip: input/tosec
	-wget --no-clobber --output-document=input/tosec.zip \
		--referer=http://www.tosecdev.org/downloads/category/37-2016-07-02?download=73:tosec-dat-pack-complete-2313-tosec-v2016-07-02 \
		http://www.tosecdev.org/downloads/category/37-2016-07-02?download=73:tosec-dat-pack-complete-2313-tosec-v2016-07-02

tosec: input/tosec.zip
	unzip -u input/tosec.zip -d input/tosec

input/trurip:
	mkdir -p input/trurip

input/trurip.zip: input/trurip
	-wget --no-clobber --output-document=input/trurip.zip \
		--referer=https://github.com/RobLoach/libretro-dats/releases/tag/tr-2016.08.17 \
		https://github.com/RobLoach/libretro-dats/releases/download/tr-2016.08.17/tr.zip

trurip: input/trurip.zip
	unzip -u input/trurip.zip -d input/trurip

input/advancescene:
	mkdir -p input/advancescene

input/advancescene_psp.zip: input/advancescene
	-wget --no-clobber --output-document=input/advancescene_psp.zip \
		--referer=http://www.advanscene.com/html/dats.php \
		http://www.advanscene.com/offline/datas/ADVANsCEne_PSP.zip

input/advancescene_psn.zip: input/advancescene
	-wget --no-clobber --output-document=input/advancescene_psn.zip \
		--referer=http://www.advanscene.com/html/dats.php \
		http://www.advanscene.com/offline/datas/ADVANsCEne_PSN.zip

advancescene: input/advancescene_psn.zip input/advancescene_psp.zip
	unzip -u 'input/advancescene*.zip' -d input/advancescene

input/darkwater:
	mkdir -p input/darkwater

input/darkwater-saturn.zip: input/darkwater
	-wget --no-clobber --output-document=input/darkwater-saturn.zip \
		--referer=https://github.com/RobLoach/libretro-dats/releases/tag/darkwater-saturn-20100731 \
		https://github.com/RobLoach/libretro-dats/releases/download/darkwater-saturn-20100731/darkwater-saturn-20100731.zip

darkwater: input/darkwater-saturn.zip
	unzip -u 'input/darkwater*' -d input/darkwater
