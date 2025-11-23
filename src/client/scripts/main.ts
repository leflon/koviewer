/// <reference path="./leaflet-typings.d.ts" />
import 'leaflet.sync/L.Map.Sync';
import { DEPRECATED_CACHES } from './constants';
import {
	$,
	$$,
	blurFeature,
	createMap,
	findFeaturesByName,
	getHigherLevel,
	highlightFeature,
	initMap,
	jumpTo,
	loadData
} from './functions';
import { MapLevel } from './types';

//#region Clear deprecated caches
for (const name of DEPRECATED_CACHES) {
	caches.delete(name);
}
//#endregion

//#region Initialize maps
console.log('Loading data...');

const datasets = {
	sido: loadData('sido'),
	sgg: loadData('sgg'),
	emdong: loadData('emdong'),
	li: loadData('li')
};

const maps = {
	sido: createMap('map-sido'),
	sgg: createMap('map-sgg'),
	emdong: createMap('map-emdong'),
	li: createMap('map-li')
};

const ALL_FEATURES = {};

for (const [level, promise] of Object.entries(datasets)) {
	promise.then((data) => {
		initMap(maps[<MapLevel>level], <MapLevel>level, data, ALL_FEATURES);
	});
}

// Sync maps
for (const map of Object.values(maps)) {
	for (const otherMap of Object.values(maps)) {
		if (map !== otherMap) {
			map.sync(otherMap);
		}
	}
}
//#endregion

//#region Bind settings UI
let displayedMapsCount = 0;
const container = $('#maps-container');
for (const button of $$('#controls .show-toggle')) {
	const level = (button as HTMLButtonElement).dataset.level as MapLevel;
	const mapElement = $(`#map-${level}`);

	// Initialize - buttons start with 'active' class
	if (button.classList.contains('active')) {
		displayedMapsCount++;
		mapElement.classList.add('visible');
	}

	button.addEventListener('click', () => {
		const isActive = button.classList.toggle('active');
		displayedMapsCount += isActive ? 1 : -1;
		container.dataset.displayedMaps = displayedMapsCount.toString();

		// Toggle map visibility
		if (isActive) {
			mapElement.classList.add('visible');
		} else {
			mapElement.classList.remove('visible');
		}

		// Timeout lets the map be hidden before we invalidate the sizes,
		// which reduces lag
		setTimeout(() => {
			for (const map of Object.values(maps)) map.invalidateSize();
		});
	});
}
container.dataset.displayedMaps = displayedMapsCount.toString();
//#endregion

//#region Bind responsive search toggle
const searchToggle = $('#responsive-search-toggle') as HTMLButtonElement;
if (searchToggle) {
	searchToggle.addEventListener('click', () => {
		document.body.classList.toggle('search-open');
	});
}
//#endregion

//#region Bind info modal
const infoModalOpen = $('#info-modal-open') as HTMLButtonElement;
const infoModalClose = $('#close-modal') as HTMLButtonElement;
const infoContainer = $('#info-container');

if (infoModalOpen) {
	infoModalOpen.addEventListener('click', () => {
		infoContainer.classList.add('visible');
		// Moves the keyboard navigation position right next to the close button,
		// so users can focus the close button just by hitting tab once.
		infoModalClose.focus();
		infoModalClose.blur();
	});
}

if (infoModalClose) {
	infoModalClose.addEventListener('click', () => {
		infoContainer.classList.remove('visible');
	});
}

// Close modal when clicking outside
if (infoContainer) {
	infoContainer.addEventListener('click', (e) => {
		if (e.target === infoContainer) {
			infoContainer.classList.remove('visible');
		}
	});
}

// Close modal when pressing escape
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		infoContainer.classList.remove('visible');
	}
});
//#endregion

//#region Allow horizontal scrolling with mouse wheel on controls
const controls = $('#controls');
controls.addEventListener('wheel', (e) => {
	if (e.deltaY === 0) return;
	e.preventDefault();
	controls.scrollBy({
		left: e.deltaY < 0 ? -100 : 100,
		behavior: 'smooth'
	});
});
//#endregion

//#region Bind tooltips to mouse position

// Track mouse down state to avoid conflicting with Leaflet drag interactions
const mouseDown = {
	sido: false,
	sgg: false,
	emdong: false,
	li: false
};

$$('#maps-container .map').forEach((map) => {
	const level = map.id.slice(4) as MapLevel;

	// This feeds the mouseDown record
	map.addEventListener('mousedown', () => (mouseDown[level] = true));
	map.addEventListener('mouseup', () => (mouseDown[level] = false));

	// Ensures all tooltips are hidden when the mouse leaves a map, so we don't have stuck tooltips
	map.addEventListener('mouseleave', () => {
		mouseDown[level] = false;
		// We have to dispatch the event to the actual Leaflet map canvas, so that the underlying
		// features also receive the event and unhighlight themselves, causing the tooltips to hide
		$(`#map-${level} .leaflet-map-pane canvas`).dispatchEvent(new MouseEvent('mouseout'));
		// Also hide the tooltip of the higher map (and by cascade, all higher maps) by simulating mouseleave on them
		const higherMap = $(`#map-${getHigherLevel(level)}`);
		if (higherMap) higherMap.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
	});

	(<HTMLDivElement>map).addEventListener('mousemove', (e) => {
		const level = map.id.slice(4) as MapLevel;
		const mapRect = map.getBoundingClientRect();
		// A tooltip should never go outside its map's boundaries
		const LIMITS = {
			left: mapRect.left,
			top: mapRect.top,
			right: mapRect.right,
			bottom: mapRect.bottom
		};
		const tooltip = $(`#tooltips-container .tooltip[data-bind="${level}"]`);
		const toolTipRect = tooltip.getBoundingClientRect();
		// Position the tooltip's center relative to the cursor, 30px below it
		let x = e.clientX - toolTipRect.width / 2;
		let y = e.clientY - toolTipRect.height / 2 + 30;
		// Apply tooltip boundary limits
		if (x + toolTipRect.width >= LIMITS.right) x = LIMITS.right - toolTipRect.width;
		if (x <= LIMITS.left) x = LIMITS.left;
		if (y + toolTipRect.height >= LIMITS.bottom) y = LIMITS.bottom - toolTipRect.height;
		if (y <= LIMITS.top) y = LIMITS.top;
		tooltip.style.top = y + 'px';
		tooltip.style.left = x + 'px';

		/* Simulate the same event on other maps to move their tooltips as well */
		// Don't do this if the mouse is down, to avoid interfering with drag interactions
		if (mouseDown[level]) return;

		const higherLevel = getHigherLevel(level);
		// When mouse is on the highest map, there's no higher map to sync to
		if (!higherLevel) return;
		const higherMapDOM = <HTMLDivElement>$(`#map-${higherLevel}`);
		const higherMapRect = higherMapDOM.getBoundingClientRect();

		// The tooltip is positioned relative to the whole viewport,
		// so we need to project the mouse position onto the map
		// We can't use layerX/layerY
		const newClientX = higherMapRect.left + e.clientX - mapRect.left;
		const newClientY = higherMapRect.top + e.clientY - mapRect.top;
		const canvas = $(`#map-${higherLevel} .leaflet-map-pane canvas`) as HTMLCanvasElement;
		const event = new MouseEvent('mousemove', {
			clientX: newClientX,
			clientY: newClientY,
			bubbles: true
		});
		canvas.dispatchEvent(event);
	});
});
//#endregion

//#region Search functionality
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
		elm.title = name;
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
//#endregion
