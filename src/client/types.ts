import { FeatureGroup } from 'leaflet';

/**
 * Administrative division level names from `southkorea-maps`:
 * - `sido`: Provinces and metropolitan cities
 * - `sgg`: Cities, counties and districts
 * - `emdong`: Sub-municipal level
 * - `li`: Villages
 */
export type MapLevel = 'sido' | 'sgg' | 'emdong' | 'li';

/**
 * Map of layers by name
 */
export type LayerMap = Record<string, FeatureGroup>;
