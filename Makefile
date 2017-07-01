libretro-database/Makefile:
	git submodule update --init

node_modules:
	npm install

test: libretro-database/Makefile node_modules
	npm test
