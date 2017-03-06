default: nointro redump tosec trurip advancescene darkwater

clean:
	rm -rf input

input/nointro:
	mkdir -p input/nointro

input/nointro.zip: input/nointro
	-wget --no-clobber --output-document=input/nointro.zip \
		--referer=http://www.emulab.it/rommanager/datfiles.php?category=14 \
		http://www.emulab.it/rommanager/getfile.php?id=a925415748db28169826f6eed536f1c0

nointro: input/nointro.zip
	unzip -u input/nointro.zip -d input/nointro

input/redump:
	mkdir -p input/redump

input/redump.zip: input/redump
	#-wget --no-clobber --output-document=input/redump.zip \
		--referer=http://www.emulab.it/rommanager/datfiles.php?category=15 \
		http://www.emulab.it/rommanager/getfile.php?id=f92152505cb7cc9b2c4885f5cc3277e4

redump: #input/redump.zip
	#unzip -u input/redump.zip -d input/redump

input/tosec:
	mkdir -p input/tosec

input/tosec.zip: input/tosec
	-wget --no-clobber --output-document=input/tosec.zip \
		--referer=http://www.tosecdev.org/downloads/category/38-2016-11-11 \
		http://www.tosecdev.org/downloads/category/38-2016-11-11?download=75:tosec-dat-pack-complete-2321-tosec-v2016-11-11

tosec: input/tosec.zip
	unzip -u input/tosec.zip -d input/tosec

input/trurip:
	mkdir -p input/trurip

input/trurip.zip: input/trurip
	-wget --no-clobber --output-document=input/trurip.zip \
		--referer=https://github.com/RobLoach/libretro-dats/releases/tag/tr-2016.11.16 \
		https://github.com/RobLoach/libretro-dats/releases/download/tr-2016.11.16/tr-2016.11.16.zip

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
