import { Feature } from 'geojson';
import L, { LeafletEventHandlerFn } from 'leaflet';
import { feature } from 'topojson-client';
import {
	CACHE_NAME,
	DEFAULT_LATLNG,
	DEFAULT_ZOOM_LEVEL,
	DIVISIONS_COLORS,
	HIGHLIGHTED_FILL_OPACITY,
	REGULAR_FILL_OPACITY,
	STROKE_WEIGHT,
	TILE_LAYER_URI,
	TOPOLOGY_OBJECTS_KEY
} from './constants';
import { LayerMap as FeatureMap, MapLevel } from './types';

/** Shortcut for `document.querySelector` */
export const $ = (selector: string) => document.querySelector(selector) as HTMLElement;
/** Shortcut for `document.querySelectorAll` */
export const $$ = (selector: string) => document.querySelectorAll(selector);

/**
 * Gets the higher administrative level of a given level.
 * @param level The current level
 * @returns The higher level, or `null` if the given level is the highest one.
 */
export function getHigherLevel(level: MapLevel): MapLevel | null {
	switch (level) {
		case 'li':
			return 'emdong';
		case 'emdong':
			return 'sgg';
		case 'sgg':
			return 'sido';
		case 'sido':
			return null;
	}
}

/**
 * Converts a TopoJSON object to GeoJSON
 * @param level The administrative level corresponding to this topography
 * @param topo The topology object to convert
 * @returns Converted GeoJSON object
 */
export async function topoToGeo(level: MapLevel, topo: TopoJSON.Topology) {
	const geojson = feature(topo, TOPOLOGY_OBJECTS_KEY[level]);
	return geojson;
}

/**
 * Fetches topology data from cache or server.
 * @param level The administrative division level to fetch
 * @returns The corresponding GeoJSON data.
 */
export async function loadData(level: MapLevel) {
	const url = `/geo/${level}`;
	const cache = await caches.open(CACHE_NAME);

	const cached = await cache.match(url);
	if (cached) {
		console.log(`Retrieved ${level} from cache.`);
		return topoToGeo(level, await cached.json());
	}

	const res = await fetch(`/geo/${level}`);
	if (res.ok) cache.put(url, res.clone());
	else throw new Error(`Failed to fetch ${level} topography data`);

	return topoToGeo(level, await res.json());
}

/**
 * Creates a Leaflet map
 * @param htmlId The id of the HTML element rendering the map.
 * @returns The created map object
 */
export function createMap(htmlId: string): L.Map {
	const map = L.map(htmlId, {
		preferCanvas: true,
		renderer: L.canvas({
			padding: 0.5
		}),
		zoomControl: false
	}).setView(DEFAULT_LATLNG, DEFAULT_ZOOM_LEVEL);
	// We disable double click zoom to prevent zooming
	// when we simulate double click events (see in initMap->onEachFeature)
	// That would simply crash the app
	map.doubleClickZoom.disable();
	L.control.zoom({ position: 'bottomright' }).addTo(map);
	L.control.scale({ imperial: false }).addTo(map);
	return map;
}

/**
 * Initializes a map, adding map tiles and geojson layers.
 * @param map The map to initialize
 * @param level The level of the given Map
 * @param features The features to render onto the map
 * @param featuresStore The record that will receive all the features from this map
 */
export async function initMap(map: L.Map, level: MapLevel, features: Feature, featuresStore: Record<string, L.Layer>) {
	const tooltip = $(`.tooltip[data-bind="${level}"]`);
	$(`#map-${level}`).dataset.loading = 'false';
	const baseLayer = L.tileLayer(TILE_LAYER_URI);
	baseLayer.addTo(map);

	// This ensures only one feature is highlighted at a time
	let currentHighlight: L.FeatureGroup | null = null;

	L.geoJSON(features, {
		style: (feature) => {
			const suffix = feature!.properties.name.slice(-1);
			return {
				color: DIVISIONS_COLORS[level][suffix],
				fillOpacity: REGULAR_FILL_OPACITY,
				weight: STROKE_WEIGHT
			};
		},
		onEachFeature: (feature, layer) => {
			const name = feature.properties.name;
			const englishName = feature.properties.name_eng;
			featuresStore[`${name} (${englishName})`] = layer;
			const suffix = name.slice(-1);
			const mouseoverHandler: LeafletEventHandlerFn = (e) => {
				/* This is useful when using our 'dblclick' event simulating hack.
					Since leaflet does not listen to mouse events at all in this context,
					It can't trigger `mouseout`, which would blur the previous feature.
					Hence, we have to make sure by ourselves that we don't leave a tray of
					highlighted features.
				 */
				if (currentHighlight) blurFeature(currentHighlight);
				currentHighlight = e.target;

				highlightFeature(e.target);
				tooltip.style.display = 'block';
				tooltip.style.color = DIVISIONS_COLORS[level][suffix];
				tooltip.innerHTML = `<div class='tooltip-ko'>${name}</div><div class='tooltip-en'>${englishName}</div>`;
			};
			layer.on({
				mouseover: mouseoverHandler,
				mouseout: (e) => {
					blurFeature(e.target);
					tooltip.style.display = 'none';
				},
				click: (e) => {
					jumpTo(e.target);
				},
				/**
				 * On mobile, we want to simulate a mousemove event on the center of the Map
				 * to update the tooltips. while the mouse moves. This works on all synced maps,
				 * except the one that is being dragged. This is because Leaflet does not listen
				 * to custom mousemove events during dragging to avoid conflicts. To workaround this
				 * limitation, we can simply simulate a doubleclick event instead, which will trigger
				 * the same actions, but Leaflet will handle it even while dragging.
				 */
				dblclick: mouseoverHandler
			});
		}
	}).addTo(map);
}

/**
 * Finds entries from a FeatureMap which names match the given query
 * @param features The feature collection to search from
 * @param query The name query, any features which name includes this string will be matched
 * @returns The matched features
 */
export function findFeaturesByName(features: FeatureMap, query: string): FeatureMap {
	const foundNames = Object.keys(features)
		.filter((name) => name.toLowerCase().includes(query))
		.slice(0, 20);

	const foundFeatures: FeatureMap = {};
	for (const name of foundNames) {
		foundFeatures[name] = features[name];
	}
	return foundFeatures;
}

/**
 * Zooms into a given feature.
 * @param feature The feature to zoom into.
 */
export function jumpTo(feature: L.FeatureGroup) {
	(<any>feature)._map.fitBounds(feature.getBounds());
}

/**
 * Highlights a feature by making it more opaque.
 * @param feature The feature to highlight
 */
export function highlightFeature(feature: L.FeatureGroup) {
	feature.setStyle({
		fillOpacity: HIGHLIGHTED_FILL_OPACITY
	});
}

/**
 * Un-highlight a feature
 * @param feature The feature to blur
 */
export function blurFeature(feature: L.FeatureGroup) {
	feature.setStyle({
		fillOpacity: REGULAR_FILL_OPACITY
	});
}
