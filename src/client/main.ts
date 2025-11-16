/// <reference path="./leaflet-typings.d.ts" />
import 'leaflet.sync/L.Map.Sync';
import { DEPRECATED_CACHES } from './constants';
import {
	$,
	$$,
	blurFeature,
	createMap,
	findFeaturesByName,
	highlightFeature,
	initMap,
	jumpTo,
	loadData
} from './functions';
import { MapLevel } from './types';

/* Clear potential previous versions caches */
for (const name of DEPRECATED_CACHES) {
	caches.delete(name);
}

/* Initialize maps */
console.log('Loading data...');

const datasets = {
	sido: loadData('sido'),
	sgg: loadData('sgg'),
	emdong: loadData('emdong')
};

const maps = {
	sido: createMap('map-sido'),
	sgg: createMap('map-sgg'),
	emdong: createMap('map-emdong')
};

const ALL_FEATURES = {};

for (const [level, promise] of Object.entries(datasets)) {
	promise.then((data) => {
		initMap(maps[level], <MapLevel>level, data, ALL_FEATURES);
	});
}

/* Sync maps */
for (const map of Object.values(maps)) {
	for (const otherMap of Object.values(maps)) {
		if (map !== otherMap) {
			map.sync(otherMap);
		}
	}
}

/* Bind settings UI */
for (const checkbox of $$('#controls input[type=checkbox]')) {
	checkbox.addEventListener('change', (e) => {
		// Timeout lets the map be hidden before we invalidate the sizes,
		// which reduces lag
		setTimeout(() => {
			for (const map of Object.values(maps)) map.invalidateSize();
		});
	});
}

/* Bind tooltip to mouse position */
$('#maps-container').addEventListener('mousemove', (e) => {
	const tooltip = $('#tooltip');
	const rect = tooltip.getBoundingClientRect();
	// Position the tooltip's center relative to the cursor, 30px below it
	let x = e.clientX - rect.width / 2;
	let y = e.clientY - rect.height / 2 + 30;
	// Prevent tooltip from clipping out of the viewport
	if (x + rect.width >= window.innerWidth) x = window.innerWidth - rect.width;
	if (x <= 0) x = 0;
	if (y + rect.height >= window.innerHeight) y = window.innerHeight - rect.height;
	if (y <= 0) y = 0;
	tooltip.style.top = y + 'px';
	tooltip.style.left = x + 'px';
});

/* Handle search features */
const resultsContainer = $('#search-results');
const input = $('#search-input') as HTMLInputElement;

const clearResults = () => (resultsContainer.innerHTML = '');
const hideResults = () => (resultsContainer.style.display = 'none');
const showResults = () => (resultsContainer.style.display = 'block');

input.addEventListener('focus', showResults);
input.addEventListener('blur', () => {
	// Timeout allows for the potential next focusable element to be focused, allowing this check to function
	setTimeout(() => {
		if (!document.activeElement || !document.activeElement.classList.contains('search-result')) {
			hideResults();
		}
	});
});
input.addEventListener('input', (e) => {
	const query = (e.target as HTMLInputElement).value.trim();
	if (query.length === 0) {
		clearResults();
		hideResults();
		return;
	}

	const results = findFeaturesByName(ALL_FEATURES, query);
	clearResults();
	for (const [name, feature] of Object.entries(results)) {
		const elm = document.createElement('div');
		elm.className = 'search-result';
		elm.textContent = name;
		elm.setAttribute('tabindex', '0'); // Alows tab focus

		const select = () => {
			jumpTo(feature);
			hideResults();
			clearResults();
			input.value = '';
			blurFeature(feature);
		};

		showResults();

		elm.addEventListener('click', select);
		elm.addEventListener('mouseenter', () => highlightFeature(feature));
		elm.addEventListener('mouseleave', () => blurFeature(feature));
		// Keyboard navigation
		elm.addEventListener('keydown', (e) => e.key === 'Enter' && select());
		elm.addEventListener('focus', () => highlightFeature(feature));
		elm.addEventListener('blur', () => {
			blurFeature(feature);
			// timeout: Same reason as above
			setTimeout(() => {
				if (
					!document.activeElement ||
					// Hide only when we don't focus another search result or the input
					(!document.activeElement.classList.contains('search-result') && document.activeElement !== input)
				) {
					hideResults();
				}
			});
		});
		resultsContainer.appendChild(elm);
	}
});
