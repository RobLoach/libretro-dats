TOSEC_URL=		https://www.tosecdev.org/downloads/category/40-2017-08-01?download=79:tosec-dat-pack-complete-2480-tosec-v2017-08-01

REDUMP_URL=		http://redump.org/datfile
REDUMP_CUES_URL=	http://redump.org/cues
REDUMP_GDI_URL=	http://redump.org/gdi

REDUMP_SYSTEMS+=	xbox-bios
REDUMP_SYSTEMS+=	gc-bios
REDUMP_SYSTEMS+=	psx-bios
REDUMP_SYSTEMS+=	ps2-bios
REDUMP_SYSTEMS+=	mac
REDUMP_SYSTEMS+=	playdia
REDUMP_SYSTEMS+=	pippin
REDUMP_SYSTEMS+=	acd
REDUMP_SYSTEMS+=	cd32
REDUMP_SYSTEMS+=	cdtv
REDUMP_SYSTEMS+=	fmt
REDUMP_SYSTEMS+=	pc
REDUMP_SYSTEMS+=	hs
REDUMP_SYSTEMS+=	xbox
REDUMP_SYSTEMS+=	pc-88
REDUMP_SYSTEMS+=	pc-98
REDUMP_SYSTEMS+=	pc-fx
REDUMP_SYSTEMS+=	pce
REDUMP_SYSTEMS+=	gc
REDUMP_SYSTEMS+=	palm
REDUMP_SYSTEMS+=	3do
REDUMP_SYSTEMS+=	cdi
REDUMP_SYSTEMS+=	photo-cd
REDUMP_SYSTEMS+=	dc
REDUMP_SYSTEMS+=	scd
REDUMP_SYSTEMS+=	ss
REDUMP_SYSTEMS+=	ngcd
REDUMP_SYSTEMS+=	psx
REDUMP_SYSTEMS+=	ps2
REDUMP_SYSTEMS+=	vflash
REDUMP_SYSTEMS+=	triforce
REDUMP_SYSTEMS+=	chihiro
REDUMP_SYSTEMS+=	lindbergh
REDUMP_SYSTEMS+=	naomi

default:
	@echo "Available commands:"
	@echo "    make input/redump"
	@echo "    make input/tosec"

input/redump:
	for i in $(REDUMP_SYSTEMS); do \
		mkdir -p temp/$$i/; \
		curl -L $(REDUMP_URL)/$$i -o temp/dat.$$i.zip ;\
		if [ "$$i" = "dc" ]; then \
			curl -L $(REDUMP_GDI_URL)/$$i -o temp/cue.$$i.zip ;\
		else \
			curl -L $(REDUMP_CUES_URL)/$$i -o temp/cue.$$i.zip ;\
		fi; \
		unzip -o temp/dat.$$i.zip -d temp/$$i || true ;\
		unzip -o temp/cue.$$i.zip -d temp/$$i || true ;\
	done
	mkdir -p input
	mv temp input/redump

input/tosec: temp/tosec.zip
	unzip -o temp/tosec.zip -d input/tosec

temp/tosec.zip:
	curl -L "$(TOSEC_URL)" -o temp/tosec.zip

clean:
	rm -r temp

libretro-database/Makefile:
	git submodule update --init

node_modules:
	npm install

test: libretro-database/Makefile node_modules
	npm test
