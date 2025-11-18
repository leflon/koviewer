import mapshaper from 'mapshaper';

const FEATURE_PREFIX_BY_LEVEL = {
    sido: 'CTP',
    sgg: 'SIG',
    emdong: 'EMD',
    li: 'LI'
}

function convertFile(level) {
    console.log(`[${level}] Starting conversion...`);
    const prefix = FEATURE_PREFIX_BY_LEVEL[level];
    const tempFileName = `${level}.geojson`;
    mapshaper.runCommands(`-i data/raw/${level}/${level}.shp encoding=euc-kr -proj wgs84 -rename-fields name=${prefix}_KOR_NM,name_eng=${prefix}_ENG_NM -simplify 10% -o ${tempFileName} format=geojson`, (err) => {
        if(err) {
            console.error(`[${level}] [GeoJSON] ERROR: `, err);
        } else {
            console.log(`[${level}] [GeoJSON] Completed..`);
        }
        mapshaper.runCommands(`-i ${tempFileName} -o data/topo/${level}.json format=topojson`, async (err) => {
            if(err) {
                console.error(`[${level}] [TopoJSON] ERROR: `, err);
            } else {
                console.log(`[${level}] [TopoJSON] Completed..`);
            }
            console.log(`[${level}] Removing temporary GeoJSON file...`);
            await Bun.file(tempFileName).delete();
            console.log(`[${level}] All done.`);
        });
    });
}

convertFile('sido');
convertFile('sgg');
convertFile('emdong');
convertFile('li');