import { BBox, Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
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
import { LngLatBoundsLike, Map, MapGeoJSONFeature, MapMouseEvent, StyleLayer } from 'maplibre-gl';

/** Shortcut for `document.querySelector` */
export const $ = (selector: string) => document.querySelector(selector) as HTMLElement;
/** Shortcut for `document.querySelectorAll` */
export const $$ = (selector: string) => document.querySelectorAll(selector);

const LEVELS_IN_ORDER = ['li', 'emdong', 'sgg', 'sido'] as const;
/**
 * Gets the higher administrative level of a given level.
 * @param level The current level
 * @returns The higher level, or `null` if the given level is the highest one.
 */
export function getHigherLevel(level: MapLevel): MapLevel | null {
	const index = LEVELS_IN_ORDER.indexOf(level);
	if (index === -1) return null;
	return LEVELS_IN_ORDER[index + 1] ?? null;
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
	if (process.env.NODE_ENV === 'development') {
		console.warn('Bypassing cache for development.');
		return topoToGeo(level, await (await fetch(`/geo/${level}`)).json());
	}
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
export function createMap(htmlId: string): Map {
	const map = new Map({
		container: htmlId,
		style: 'https://tiles.openfreemap.org/styles/positron',
		center: DEFAULT_LATLNG,
		zoom: DEFAULT_ZOOM_LEVEL
	});
	// We disable double click zoom to prevent zooming
	// when we simulate double click events 
	// That would simply crash the app
  map.doubleClickZoom.disable();
	return map;
}

/**
 * Initializes a map, adding map tiles and geojson layers.
 * @param map The map to initialize
 * @param level The level of the given Map
 * @param features The features to render onto the map
 * @param featuresStore The record that will receive all the features from this map
 */
export async function initMap(map: Map, level: MapLevel, features: Feature, featuresStore: Record<string, L.Layer>) {
	const tooltip = $(`.tooltip[data-bind="${level}"]`);
	$(`#map-${level}`).dataset.loading = 'false';

	map.addSource('gis', {
		type: 'geojson',
		data: features,
		promoteId: 'id'
	});
	map.addLayer({
		id: 'gis-fill',
		source: 'gis',
		type: 'fill',
		paint: {
			'fill-color': ['get', 'color'],
			'fill-opacity': [
				'case',
				['to-boolean', ['feature-state', 'hover']],
				HIGHLIGHTED_FILL_OPACITY,
				REGULAR_FILL_OPACITY
			]
		}
	});
	map.addLayer({
		id: 'gis-outline',
		source: 'gis',
		type: 'line',
		paint: {
			'line-color': ['get', 'color'],
			'line-width': STROKE_WEIGHT
		}
	});

	let currentHighlight: Feature | null = null;

	const mouseMoveHandler = (
		e: MapMouseEvent & {
			features?: MapGeoJSONFeature[];
		} & Object
	) => {
		if (currentHighlight) blurFeature(map, currentHighlight);
		if (!e.features?.[0]) return;
		const feature = e.features[0];
		currentHighlight = feature;
		highlightFeature(map, feature);
		
		const suffix = feature.properties.name.slice(-1);
		tooltip.style.display = 'block';
		tooltip.style.color = DIVISIONS_COLORS[level][suffix];
		tooltip.innerHTML = `<div class='tooltip-ko'>${feature.properties.name}</div><div class='tooltip-en'>${feature.properties.name_eng}</div>`;
	};
	map.on('mousemove', 'gis-fill', mouseMoveHandler);
	map.on('dblclick', 'gis-fill', mouseMoveHandler);
	map.on('mouseleave', 'gis-fill', () => {
		if (currentHighlight) blurFeature(map, currentHighlight);
		tooltip.style.display = 'none';
	});

	map.on('click', 'gis-fill', (e) => {
		if (!e.features?.[0]) return;
		const feature = e.features[0];
    jumpTo(map, feature);
	});

	// L.geoJSON(features, {
	// 	style: (feature) => {
	// 		const suffix = feature!.properties.name.slice(-1);
	// 		return {
	// 			color: DIVISIONS_COLORS[level][suffix],
	// 			fillOpacity: REGULAR_FILL_OPACITY,
	// 			weight: STROKE_WEIGHT
	// 		};
	// 	},
	// 	onEachFeature: (feature, layer) => {
	// 		const name = feature.properties.name;
	// 		const englishName = feature.properties.name_eng;
	// 		featuresStore[`${name} (${englishName})`] = layer;
	// 		const suffix = name.slice(-1);
	// 		const mouseoverHandler: LeafletEventHandlerFn = (e) => {
	// 			/* This is useful when using our 'dblclick' event simulating hack.
	// 				Since leaflet does not listen to mouse events at all in this context,
	// 				It can't trigger `mouseout`, which would blur the previous feature.
	// 				Hence, we have to make sure by ourselves that we don't leave a tray of
	// 				highlighted features.
	// 			 */
	// 			if (currentHighlight) blurFeature(currentHighlight);
	// 			currentHighlight = e.target;

	// 			highlightFeature(e.target);
	// 			tooltip.style.display = 'block';
	// 			tooltip.style.color = DIVISIONS_COLORS[level][suffix];
	// 			tooltip.innerHTML = `<div class='tooltip-ko'>${name}</div><div class='tooltip-en'>${englishName}</div>`;
	// 		};
	// 		layer.on({
	// 			mouseover: mouseoverHandler,
	// 			mouseout: (e) => {
	// 				blurFeature(e.target);
	// 				tooltip.style.display = 'none';
	// 			},
	// 			click: (e) => {
	// 				jumpTo(e.target);
	// 			},
	// 			/**
	// 			 * On mobile, we want to simulate a mousemove event on the center of the Map
	// 			 * to update the tooltips. while the mouse moves. This works on all synced maps,
	// 			 * except the one that is being dragged. This is because Leaflet does not listen
	// 			 * to custom mousemove events during dragging to avoid conflicts. To workaround this
	// 			 * limitation, we can simply simulate a doubleclick event instead, which will trigger
	// 			 * the same actions, but Leaflet will handle it even while dragging.
	// 			 */
	// 			dblclick: mouseoverHandler
	// 		});
	// 	}
	// }).addTo(map);
}

/**
 * Finds entries from a FeatureMap which names match the given query
 * @param features The feature collection to search from
 * @param query The name query, any features which name includes this string will be matched
 * @returns The matched features
 */
export function findFeaturesByName(maps: Record<MapLevel, Map>, query: string): Array<{
  level: MapLevel,
  map: Map,
  feature: Feature
}> {
	const foundFeatures: Array<{ level: MapLevel, map: Map, feature: Feature }> = [];
  for (const [level, map] of Object.entries(maps)) {
    const source = map.getSource('gis');
    const serialized = source?.serialize() as { data: {features: Feature[] } };
    if (!serialized) return [];
    
    const matches = serialized.data.features.filter(f =>
      f.properties!.name_eng.toLowerCase().includes(query.toLowerCase())
      || f.properties!.name.includes(query)
    );
    foundFeatures.push(...matches.map((feature) => ({ level: level as MapLevel, map, feature })));
  }
  return foundFeatures;
}

export function bbox(feature: Feature): LngLatBoundsLike {
const coords = (feature.geometry as any).coordinates.flat(Infinity);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
}

/**
 * Zooms into a given feature.
 * @param target The feature to zoom into.
 */
export function jumpTo(map: Map, target: Feature) {
  const source = map.getSource('gis')?.serialize() as { data: { features: Feature[] } };
  if (!source)
    return;
  console.log(source);
  const fullFeature = source.data.features.find(f => f.properties!.id === target.properties!.id);
  if (!fullFeature)
    return;
  console.log(fullFeature);
  map.fitBounds(bbox(fullFeature), {padding: 40});
}

/**
 * Highlights a feature by making it more opaque.
 * @param map The map to highlight the feature on
 * @param layer The layer to which the feature belongs
 * @param feature The feature to highlight
 */
export function highlightFeature(map: Map, feature: Feature) {
	map.setFeatureState(
		{
			source: 'gis',
			id: feature.properties!.id as string
		},
		{ hover: true }
	);
}

/**
 * Un-highlight a feature
 * @param map The map to un-highlight the feature on
 * @param layer The layer to which the feature belongs
 * @param feature The feature to un-highlight
 */
export function blurFeature(map: Map, feature: Feature) {
	map.setFeatureState(
		{
			source: 'gis',
			id: feature.properties!.id as string
		},
		{ hover: false }
	);
}
