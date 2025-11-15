async function loadData(id) {
	async function convert(res) {
		const topo = await res.json();
		console.time('convert-' + id);
		const geojson = topojson.feature(topo, topo.objects[id.replace(/-/g, '_') + '_geo']);
		console.timeEnd('convert-' + id);
		return geojson;
	}

	const CACHE_NAME = 'geojson-cache-v2';
	const url = `/geo/${id}-topo`;
	const cache = await caches.open(CACHE_NAME);

	const cached = await cache.match(url);
	if (cached) {
		console.log(`Retrieved ${id} from cache.`);
		return convert(cached);
	}

	const res = await fetch(`/geo/${id}-topo`);
	if (res.ok) cache.put(url, res.clone());
	return convert(res);
}
function createMap(selector) {
	const map = L.map(selector, {
		preferCanvas: true,
		zoomControl: false
	}).setView([36.05591712705268, 127.9057675953637], 7);
	L.control.zoom({ position: 'bottomright' }).addTo(map);
	L.control.scale({ imperial: false }).addTo(map);
	return map;
}

console.log('Loading GeoJSON data...');

const datasets = {
	sido: loadData('skorea-provinces-2018'),
	sgg: loadData('skorea-municipalities-2018'),
	emdong: loadData('skorea-submunicipalities-2018')
};

const COLORS = {
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
		동: '#20750D'
	}
};

const TOOLTIP = document.getElementById('tooltip');
document.getElementById('maps-container').addEventListener('mousemove', (e) => {
	const rect = TOOLTIP.getBoundingClientRect();
	let x = e.clientX - rect.width / 2;
	let y = e.clientY - rect.height / 2 + 30;
	if (x + rect.width >= window.innerWidth) x = window.innerWidth - rect.width;
	if (x <= 0) x = 0;
	if (y + rect.height >= window.innerHeight) y = window.innerHeight - rect.height;
	if (y <= 0) y = 0;
	TOOLTIP.style.top = y + 'px';
	TOOLTIP.style.left = x + 'px';
});

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

document.querySelectorAll('#controls input[type=checkbox]').forEach((checkbox) => {
	checkbox.addEventListener('change', () => {
		Object.values(maps).forEach((map) => map.invalidateSize());
	});
});

async function resolveMap(level) {
	document.querySelector(`.map#map-${level}`).dataset.loading = 'false';
	const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png');
	L.geoJSON(await datasets[level], {
		style: (feature) => {
			const suffix = feature.properties.name.slice(-1);
			return {
				color: COLORS[level][suffix],
				fillOpacity: 0.2,
				weight: 1.5
			};
		},
		onEachFeature: (feature, layer) => {
			const suffix = feature.properties.name.slice(-1);
			layer.on({
				mouseover: (e) => {
					e.target.setStyle({
						fillOpacity: 0.5
					});
					console.log(e);
					TOOLTIP.style.display = 'block';
					TOOLTIP.style.color = COLORS[level][suffix];
					TOOLTIP.textContent = feature.properties.name;
				},
				mouseout: (e) => {
					TOOLTIP.style.display = 'none';
					e.target.setStyle({
						fillOpacity: 0.2
					});
				},
				click: (e) => {
					maps[level].fitBounds(e.target.getBounds());
				}
			});
		}
	}).addTo(maps[level]);
	baseLayer.addTo(maps[level]);
}

for (const [level, promise] of Object.entries(datasets)) {
	promise.then(() => {
		resolveMap(level);
	});
}
