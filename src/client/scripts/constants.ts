import { LatLngExpression } from 'leaflet';
import { MapLevel } from './types';

/**
 * The key from the objects fields holding geo data in each level's Topo file.
 */
export const TOPOLOGY_OBJECTS_KEY: Record<MapLevel, string> = {
	sido: 'sido',
	sgg: 'sgg',
	emdong: 'emdong',
	li: 'li'
};

/**
 * The name of the current cache storage
 */
export const CACHE_NAME = 'geojson-cache-v4';

/**
 * The names of the previous versions' cache storages
 */
export const DEPRECATED_CACHES = ['geojson-cache-v1', 'geojson-cache-v2', 'geojson-cache-v3'];

/**
 * The default coordinates to center the maps at. (in this case, about the center of the south-korean peninsula)
 */
export const DEFAULT_LATLNG: LatLngExpression = [37.58, 127];

/**
 * The default zoom level of the maps.
 */
export const DEFAULT_ZOOM_LEVEL = 10;

/**
 * The regular fillOpacity of all leaflet features
 */
export const REGULAR_FILL_OPACITY = 0.2;

/**
 * The fillOpacity of highlighted leaflet features
 */
export const HIGHLIGHTED_FILL_OPACITY = 0.4;

/**
 * The stroke weight of features boundaries
 */
export const STROKE_WEIGHT = 1.5;

/**
 * Color codes of every administrative section type
 */
export const DIVISIONS_COLORS: Record<MapLevel, Record<string, string>> = {
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
	},
	li: {
		리: '#bebebeff'
	}
};

/**
 * The URI of Leaflet maps' tile layer.
 */
export const TILE_LAYER_URI = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
