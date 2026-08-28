/// <reference path="./leaflet-typings.d.ts" />
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEPRECATED_CACHES, DIVISIONS_COLORS } from './constants';
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
import MobileDetect from 'mobile-detect';
import { Map, MapMovementEvent, setWorkerUrl } from 'maplibre-gl';

const syncMaps = require('@mapbox/mapbox-gl-sync-move');



setWorkerUrl('/maplibre-gl-worker.mjs');

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

const maps: Record<MapLevel, Map> = {
	sido: createMap('map-sido'),
	sgg: createMap('map-sgg'),
	emdong: createMap('map-emdong'),
	li: createMap('map-li')
};

const ALL_FEATURES = {};

for (const [level, map] of Object.entries(maps)) {
	map.on('load', () => {
    const promise = datasets[level as MapLevel];
    promise.then((data) => {
      initMap(map, level as MapLevel, data, ALL_FEATURES);
    });
	});
}


// Sync maps
syncMaps(...Object.values(maps));
//#endregion

//#region Bind settings UI
let displayedMapsCount = 4;
const container = $('#maps-container');
for (const button of $$('#controls .show-toggle')) {
	const level = (button as HTMLButtonElement).dataset.level as MapLevel;
	const mapElement = $(`#map-${level}`);

	button.addEventListener('click', () => {
		const isActive = button.classList.toggle('active');
		displayedMapsCount += isActive ? 1 : -1;
		container.dataset.displayedMaps = displayedMapsCount.toString();
		mapElement.classList.toggle('visible');

		// Timeout lets the map be hidden before we invalidate the sizes,
		// which reduces lag
		setTimeout(() => {
			for (const map of Object.values(maps)) map.resize();
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

const md = new MobileDetect(navigator.userAgent);
const IS_MOBILE = md.mobile() !== null;

// Position all tooltips below their crosshair when on mobile
if (IS_MOBILE) {
	const tooltips = $$('.map-wrapper .tooltip') as NodeListOf<HTMLDivElement>;
	tooltips.forEach((tooltip) => {
		tooltip.classList.add('mobile');
	});
} else {
	$$('.map-mobile-crosshair').forEach((crosshair) => crosshair.remove());
}

// Track mouse down state to avoid conflicting with drag interactions
const mouseDown = {
	sido: false,
	sgg: false,
	emdong: false,
	li: false
};

$$('#maps-container .map').forEach((map) => {
	const level = map.id.slice(4) as MapLevel;
	const tooltip = map.parentElement?.querySelector('.tooltip') as HTMLDivElement;

	map.addEventListener('mousedown', () => (mouseDown[level] = true));
	map.addEventListener('mouseup', () => (mouseDown[level] = false));

	// Ensures all tooltips are hidden when the mouse leaves a map, so we don't have stuck tooltips
	map.addEventListener('mouseleave', () => {
		if (IS_MOBILE) return;
		mouseDown[level] = false;
    tooltip!.style.display = 'none';
		// Also hide the tooltip of the higher map (and by cascade, all higher maps) by simulating mouseleave on them
		const higherMap = $(`#map-${getHigherLevel(level)}`);
		if (higherMap) higherMap.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
	});

	(<HTMLDivElement>map).addEventListener('mousemove', (e) => {
		// This kind of mouse event has terrible UX on mobile so we replace it with another system below
		if (IS_MOBILE) return;
		const level = map.id.slice(4) as MapLevel;
		const tooltip = $(`.map-wrapper .tooltip[data-bind="${level}"]`);
		const toolTipRect = tooltip.getBoundingClientRect();

		const mapRect = map.getBoundingClientRect();
		// A tooltip should never go outside its map's boundaries
		const LIMITS = {
			left: mapRect.left,
			top: mapRect.top,
			right: mapRect.right,
			bottom: mapRect.bottom
		};
		// Position the tooltip's center relative to the cursor
		let x = e.clientX - toolTipRect.width / 2;
		let y = e.clientY - toolTipRect.height / 2 + 40; // Offset to prevent the cursor from overlapping the tooltip
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

		const newClientX = higherMapRect.left + e.clientX - mapRect.left;
		const newClientY = higherMapRect.top + e.clientY - mapRect.top;
		const canvas = $(`#map-${higherLevel} canvas`) as HTMLCanvasElement;
		if (!canvas) return;
		const event = new MouseEvent('mousemove', {
			clientX: newClientX,
			clientY: newClientY,
			bubbles: true
		});
		canvas.dispatchEvent(event);
	});
});

if (IS_MOBILE) {
	// Without this, the map will re-highlight the starting point
	// of the interaction for some reason. This acts as a guard against that.
	let isMoving = false;

	for (const map of Object.values(maps)) {
		const handler = (e: MapMovementEvent) => {
			if (!isMoving) return;
			const container = map._container;
			const rect = container.getBoundingClientRect();
			const center = [rect.left + rect.width / 2, rect.top + rect.height / 2];
			const canvas = container.querySelector(`canvas`) as HTMLCanvasElement;
			if (!canvas) return;
			// With mousemove, it wouldn't trigger the handlers for the map that is being dragged.
			// We force the handlers using dblclick, as it wouldn't be used otherwise.
			const event = new MouseEvent('dblclick', {
				clientX: center[0],
				clientY: center[1],
				bubbles: true
			});
			canvas.dispatchEvent(event);
		};
		map.on('dragstart', () => (isMoving = true));
		map.on('move', handler);
		map.on('dragend', () => (isMoving = false));
		map.on('moveend', handler);
	}
}
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
  if (query.length < 2) return;

	const results = findFeaturesByName(maps, query);
	/* Filter out hidden maps' features from the results */
	clearResults();
	for (const result of results) {
	  const fullName = `${result.feature.properties!.name} (${result.feature.properties!.name_eng})`;
    const suffix = result.feature.properties!.name.at(-1);
		const elm = document.createElement('div');
		elm.className = 'search-result';
		elm.innerHTML = `<div>${fullName}</div>`;
    elm.title = fullName;
    elm.style.setProperty('--color', DIVISIONS_COLORS[result.level][suffix]);
		elm.setAttribute('tabindex', '0'); // Alows tab focus

		const select = () => {
			jumpTo(result.map, result.feature);
			const wrapper = $(`.map-wrapper:has(#map-${result.level})`);
			wrapper?.classList.add('highlighted');
      setTimeout(() => { wrapper?.classList.remove('highlighted'); }, 1000);
			hideResults();
			clearResults();
			input.value = '';
			blurFeature(result.map, result.feature);
		};

		showResults();

		elm.addEventListener('click', select);
		elm.addEventListener('mouseenter', () => highlightFeature(result.map, result.feature));
		elm.addEventListener('mouseleave', () => blurFeature(result.map, result.feature));
		// Keyboard navigation
		elm.addEventListener('keydown', (e) => e.key === 'Enter' && select());
		elm.addEventListener('focus', () => highlightFeature(result.map, result.feature));
		elm.addEventListener('blur', () => {
			blurFeature(result.map, result.feature);
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
