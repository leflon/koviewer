import * as L from 'leaflet';

declare module 'leaflet' {
	interface Map {
		/**
		 * Imported from leaflet-sync
		 */
		sync: (map: L.Map) => void;
	}
}
