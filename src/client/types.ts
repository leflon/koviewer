import { FeatureGroup } from 'leaflet';

/**
 * Administrative division level names from `southkorea-maps`:
 * - `sido`: Provinces and metropolitan cities
 * - `sgg`: Cities, counties and districts
 * - `emdong`: Sub-municipal level
 */
export type MapLevel = 'sido' | 'sgg' | 'emdong';

/**
 * Map of layers by name
 */
export type LayerMap = Record<string, FeatureGroup>;
