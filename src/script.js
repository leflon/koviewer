function fetchWithProgress(url, onProgress = () => {}) {
    return (async () => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);

        const contentLength = resp.headers.get('content-length') || resp.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : null;

        if (!resp.body || typeof resp.body.getReader !== 'function') {
            // Fallback: no stream support — read whole response
            const text = await resp.text();
            onProgress(1);
            const blob = new Blob([text]);
            const newResp = new Response(blob, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
            return { response: newResp, json: JSON.parse(text) };
        }

        const reader = resp.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (total) {
                onProgress(received / total);
            } else {
                onProgress(Math.min(0.95, (received / (received + 100000))));
            }
        }

        // concat
        const blob = new Blob(chunks);
        const arrayBuffer = await blob.arrayBuffer();
        const jsonText = new TextDecoder().decode(arrayBuffer);
        const newResp = new Response(arrayBuffer, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
        onProgress(1);
        return { response: newResp, json: JSON.parse(jsonText) };
    })();
}

function createProgressUI(ids) {
    const container = document.getElementById('progress-container');
    if (!container) return;
    ids.forEach(id => {
        const wrapper = document.createElement('div');
        wrapper.className = 'progress-item';

        const label = document.createElement('div');
        label.textContent = id;

        const bar = document.createElement('div');
        bar.className = 'progress';

        const inner = document.createElement('div');
        inner.className = 'progress-bar';

        const pct = document.createElement('div');
        pct.className = 'progress-percentage';
        
        bar.appendChild(inner);
        wrapper.appendChild(label);
        wrapper.appendChild(bar);
        wrapper.appendChild(pct);
        container.appendChild(wrapper);
    });
}

function setProgress(id, ratio) {
    const container = document.getElementById('loading');
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.progress-item'));
    const item = items.find(it => it.firstChild && it.firstChild.textContent === id);
    if (!item) return;

    const inner = item.querySelector('.progress-bar');
    const pct = item.querySelector('.progress-percentage');
    const percent = (ratio == null) ? 0 : Math.round(ratio * 100);
    inner.style.width = (ratio == null ? '10%' : percent + '%');
    pct.textContent = ratio == null ? '…' : percent + '%';
}

async function loadData(id) {
    const CACHE_NAME = 'geojson-cache-v1';
    const url = `/geo/${id}`;
    const cache = await caches.open(CACHE_NAME);
    const cachedResp = await cache.match(url);
    // Use cache if available and mark progress 100%
    if (cachedResp) {
        setProgress(id, 1);
        return await cachedResp.json();
    }

    // fetch with streaming progress; fetchWithProgress returns both Response and JSON
    const { response: streamedResp, json } = await fetchWithProgress(url, (ratio) => setProgress(id, ratio));
    await cache.put(url, streamedResp.clone());
    return json;
}

function createMap(selector) {
    const map = L.map(selector, {preferCanvas: true, zoomControl: false}).setView([37.376535, 126.9779692], 14);
    L.control.zoom({position: 'bottomleft'}).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
    return map;

}

console.log('Loading GeoJSON data...');
// créer les barres avant d'initier les fetch
createProgressUI(['skorea-provinces-2018-geo', 'skorea-municipalities-2018-geo', 'skorea-submunicipalities-2018-geo']);

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