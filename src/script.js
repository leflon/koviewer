async function loadData(id) {
    const CACHE_NAME = 'geojson-cache-v1';
    const url = `/geo/${id}`;
    const cache = await caches.open(CACHE_NAME);
    const cachedResp = await cache.match(url);
    // Always use cache if available
    if (cachedResp) {
        return await cachedResp.json();
    }

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    await cache.put(url, resp.clone());
    return await resp.json();
}

function createMap(selector) {
    const map = L.map(selector, {preferCanvas: true, zoomControl: false}).setView([36.05591712705268, 127.9057675953637], 7);
    L.control.zoom({position: 'bottomleft'}).addTo(map);
    return map;

}

console.log('Loading GeoJSON data...');

const datasets = {
    sido: loadData('skorea-provinces-2018-geo'),
    sgg: loadData('skorea-municipalities-2018-geo'),
    emdong: loadData('skorea-submunicipalities-2018-geo')
}


const styles = {
    sido: {
        color: '#00d9ffff',
        weight: 3,
        fillOpacity: 0.1
    },
    sgg: {
        color: '#33ff88',
        weight: 2,
        fillOpacity: 0.1
    },
    emdong: {
        color: '#ff8833',
        weight: 1,
        fillOpacity: 0.1
    }
}

const maps = {};
maps.sido = createMap('map-sido');
maps.sgg = createMap('map-sgg');
maps.emdong = createMap('map-emdong');

for (const map of Object.values(maps)) {
    for (const otherMap of Object.values(maps)) {
        if (map !== otherMap) {
            map.sync(otherMap);
        }
    }
}


await Promise.all(Object.values(datasets));
document.getElementById('loading').style.display = 'none';

for (const [level, map] of Object.entries(maps)) {
    const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
    console.log(datasets[level]);
    L.geoJSON(await datasets[level], {
        style: styles[level],
        onEachFeature: (feature, layer) => {
            layer.bindTooltip(`<strong>${feature.properties.name}</strong>`, {
                permanent: true,
                direction: 'center',
                className: 'tooltip ' + level,
            });
        }

    }).addTo(map);
    baseLayer.addTo(map);
}

document.querySelectorAll('#controls input[type=checkbox]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        Object.values(maps).forEach(map => map.invalidateSize());
    }
    );
});