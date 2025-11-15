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

function findLayersByName(layers, query) {
	const foundNames = Object.keys(layers)
		.filter((name) => new RegExp(query, 'g').test(name))
		.slice(0, 20);
	console.log(foundNames);
	const result = {};
	foundNames.forEach((name) => {
		result[name] = layers[name];
	});
	return result;
}

function jumpTo(layer) {
	layer._map.fitBounds(layer.getBounds());
}
function highlightLayer(layer) {
	layer.setStyle({
		fillOpacity: 0.5
	});
}
function blurLayer(layer) {
	layer.setStyle({
		fillOpacity: 0.2
	});
}

console.log('Loading data...');

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

const LAYERS = {};

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
			LAYERS[feature.properties.name] = layer;
			const suffix = feature.properties.name.slice(-1);
			layer.on({
				mouseover: (e) => {
					highlightLayer(e.target);
					TOOLTIP.style.display = 'block';
					TOOLTIP.style.color = COLORS[level][suffix];
					TOOLTIP.textContent = feature.properties.name;
				},
				mouseout: (e) => {
					TOOLTIP.style.display = 'none';
					blurLayer(e.target);
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

const searchResultsContainer = document.querySelector('#search #search-results');
const searchInput = document.querySelector('input#search-input');
searchInput.addEventListener('input', (e) => {
	const query = e.target.value.trim();
	if (query.length === 0) {
		searchResultsContainer.style.display = 'none';
		searchResultsContainer.innerHTML = '';
		return;
	}

	const results = findLayersByName(LAYERS, query);
	searchResultsContainer.innerHTML = '';
	for (const [name, layer] of Object.entries(results)) {
		const elm = document.createElement('div');
		elm.className = 'search-result';
		elm.textContent = name;
		elm.addEventListener('click', () => {
			jumpTo(layer);
			searchResultsContainer.style.display = 'none';
		});
		elm.addEventListener('mouseenter', () => highlightLayer(layer));
		elm.addEventListener('mouseleave', () => blurLayer(layer));
		searchResultsContainer.appendChild(elm);
	}
	if (Object.keys(results).length === 0) searchResultsContainer.style.display = 'none';
	else searchResultsContainer.style.display = 'block';
});

searchInput.addEventListener('focus', () => (searchResultsContainer.style.display = 'block'));
