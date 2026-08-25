import mapshaper from 'mapshaper';

const FEATURE_PREFIX_BY_LEVEL = {
	sido: 'CTP',
	sgg: 'SIG',
	emdong: 'EMD',
	li: 'LI'
};

const DIVISIONS_COLORS = {
	sido: {
		시: '#2DA5FF',
		도: '#0D3889'
	},
	sgg: {
		시: '#FFDB1A',
		군: '#FFB100',
		구: '#FF921A'
	},
	emdong: {
		읍: '#2FFF00',
		면: '#3AD417',
    동: '#20750D',
    // Special suffixes, to be considered like 동
    가: '#20750D',
    로: '#20750D'
	},
	li: {
		리: '#bebebeff'
	}
};



function convertFile(level) {
	console.log(`[${level}] Starting conversion...`);
	const prefix = FEATURE_PREFIX_BY_LEVEL[level];
	const tempFileName = `${level}.geojson`;
	mapshaper.runCommands(
		`-i data/raw/${level}/${level}.shp encoding=euc-kr -proj wgs84 -rename-fields name=${prefix}_KOR_NM,name_eng=${prefix}_ENG_NM -simplify 10% -o ${tempFileName} format=geojson`,
		async (err) => {
			if (err) {
				console.error(`[${level}] [GeoJSON] ERROR: `, err);
			} else {
				console.log(`[${level}] [GeoJSON] Completed..`);
			}
			console.log(`[${level}] Injecting additional feature properties...`);
      const geojson = await Bun.file(tempFileName).json();
      for (const feature of geojson.features) {
        const suffix = feature.properties['name'].at(-1);
        feature.properties['color'] = DIVISIONS_COLORS[level][suffix] ?? '#000';
      }
      await Bun.write(tempFileName, JSON.stringify(geojson));
      console.log(`[${level}] Done.`);
			mapshaper.runCommands(`-i ${tempFileName} -o data/topo/${level}.json format=topojson`, async (err) => {
				if (err) {
					console.error(`[${level}] [TopoJSON] ERROR: `, err);
				} else {
					console.log(`[${level}] [TopoJSON] Completed..`);
				}
				console.log(`[${level}] Removing temporary GeoJSON file...`);
				await Bun.file(tempFileName).delete();
				console.log(`[${level}] All done.`);
			});
		}
	);
}

convertFile('sido');
convertFile('sgg');
convertFile('emdong');
convertFile('li');
