/**
 * Catálogo de capas base del mapa (SPECS_V3 §5). Todas son WMTS del IGN
 * España (CC-BY 4.0, CORS abierto, teselado GoogleMapsCompatible), de modo
 * que se intercambian sin cambiar de proveedor. La capa por defecto (MTN
 * topográfico) es la única con soporte offline: el almacén local de tiles
 * (SPECS_V2 §11) sigue ligado a ella; el resto son solo online.
 *
 * Módulo puro y testeable: no toca el DOM ni MapLibre.
 */

import {
	ignTileUrl,
	ignBaseTileUrl,
	pnoaTileUrl,
	IGN_ATTRIBUTION,
	PNOA_ATTRIBUTION
} from './tiles';

export interface MapLayer {
	/** Identificador estable (se persiste y se usa en la URL `ign://<id>/…`). */
	id: string;
	/** Nombre visible en el selector. */
	name: string;
	/** Atribución (se muestra en el control del mapa). */
	attribution: string;
	/** Zoom máximo con teselas disponibles. */
	maxzoom: number;
	/** true solo para la capa con almacén offline (MTN). */
	offline: boolean;
	/** Constructor de URL de tile. */
	tileUrl: (z: number, x: number, y: number) => string;
}

/** Capa por defecto: la mejor para leer el track (topográfico). */
export const DEFAULT_LAYER_ID = 'mtn';

export const MAP_LAYERS: MapLayer[] = [
	{
		id: 'mtn',
		name: 'Topográfico',
		attribution: IGN_ATTRIBUTION,
		maxzoom: 17,
		offline: true,
		tileUrl: ignTileUrl
	},
	{
		id: 'pnoa',
		name: 'Satélite',
		attribution: PNOA_ATTRIBUTION,
		maxzoom: 19,
		offline: false,
		tileUrl: pnoaTileUrl
	},
	{
		id: 'base',
		name: 'Callejero',
		attribution: IGN_ATTRIBUTION,
		maxzoom: 18,
		offline: false,
		tileUrl: ignBaseTileUrl
	}
];

/** Capa por id; cae a la capa por defecto si el id no existe (datos viejos). */
export function getLayer(id: string): MapLayer {
	return MAP_LAYERS.find((l) => l.id === id) ?? MAP_LAYERS.find((l) => l.id === DEFAULT_LAYER_ID)!;
}
