import * as L from 'leaflet';

declare module 'leaflet' {
	interface Map {
		/**
		 * Imported from leaflet-sync
		 */
		sync: (map: L.Map) => void;

		/**
		 * Internal container element of the map.
		 */
		_container: HTMLElement;
		_move: Function;
	}

	interface Draggable {
		_updatePosition: Function;
		_move: Function;
	}
}
