/**
 * Tiles para el mapa offline por ruta (SPECS_V2 §11). Investigación
 * (2026-06-11): la política de OpenTopoMap prohíbe la descarga masiva;
 * el WMTS del IGN España (mapa raster MTN, CC-BY 4.0, CORS abierto) sí
 * permite reutilización con atribución → es la base cartográfica de la
 * app (ya contemplada en SPEC v1 §1) y la fuente del modo offline.
 *
 * Matemática slippy-map estándar y generación de listas de tiles por
 * bbox. Puro y testeable.
 */

export interface TileCoord {
	z: number;
	x: number;
	y: number;
}

export function ignTileUrl(z: number, x: number, y: number): string {
	return (
		'https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default' +
		'&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0' +
		`&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`
	);
}

/**
 * URL de tile de la ortofoto PNOA del IGN (capa satélite, SPECS_V3 §5).
 * Mismo WMTS GoogleMapsCompatible que el MTN; CC-BY 4.0. Solo online: el
 * modo offline (almacén local) sigue ligado a la capa por defecto (MTN).
 */
export function pnoaTileUrl(z: number, x: number, y: number): string {
	return (
		'https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default' +
		'&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0' +
		`&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`
	);
}

/**
 * URL de tile del callejero IGN Base (capa "Callejero", SPECS_V3). Mismo WMTS
 * GoogleMapsCompatible; CC-BY 4.0. Solo online.
 */
export function ignBaseTileUrl(z: number, x: number, y: number): string {
	return (
		'https://www.ign.es/wmts/ign-base?layer=IGNBaseTodo&style=default' +
		'&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0' +
		`&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`
	);
}

export const IGN_ATTRIBUTION =
	'© <a href="https://www.ign.es">Instituto Geográfico Nacional de España</a> (CC-BY 4.0)';

export const PNOA_ATTRIBUTION =
	'© <a href="https://www.ign.es">IGN España</a> — PNOA máxima actualidad (CC-BY 4.0)';

export function lonToTileX(lon: number, z: number): number {
	return Math.floor(((lon + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
	const rad = (lat * Math.PI) / 180;
	return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** Niveles de zoom del mapa offline (vista de ruta). */
export const OFFLINE_ZOOMS: [number, number] = [11, 15];
/** Tope de tiles por descarga (≈ tamaño y cortesía con el IGN). */
export const MAX_OFFLINE_TILES = 600;

/**
 * Tiles que cubren el bbox en los zooms dados. Si superan el tope, se
 * recorta el zoom máximo hasta caber (mejor menos detalle que descargas
 * masivas).
 */
export function tileListForBbox(
	bbox: [number, number, number, number],
	zooms: [number, number] = OFFLINE_ZOOMS,
	maxTiles: number = MAX_OFFLINE_TILES
): TileCoord[] {
	const [minLon, minLat, maxLon, maxLat] = bbox;
	for (let maxZoom = zooms[1]; maxZoom >= zooms[0]; maxZoom--) {
		const tiles: TileCoord[] = [];
		for (let z = zooms[0]; z <= maxZoom; z++) {
			const x0 = lonToTileX(minLon, z);
			const x1 = lonToTileX(maxLon, z);
			const y0 = latToTileY(maxLat, z); // y crece hacia el sur
			const y1 = latToTileY(minLat, z);
			for (let x = x0; x <= x1; x++) {
				for (let y = y0; y <= y1; y++) tiles.push({ z, x, y });
			}
		}
		if (tiles.length <= maxTiles) return tiles;
	}
	// Ni el zoom mínimo cabe (bbox enorme): solo ese nivel, recortado.
	const z = zooms[0];
	const tiles: TileCoord[] = [];
	const x0 = lonToTileX(minLon, z);
	const x1 = lonToTileX(maxLon, z);
	const y0 = latToTileY(maxLat, z);
	const y1 = latToTileY(minLat, z);
	outer: for (let x = x0; x <= x1; x++) {
		for (let y = y0; y <= y1; y++) {
			tiles.push({ z, x, y });
			if (tiles.length >= maxTiles) break outer;
		}
	}
	return tiles;
}

export function tileStoreKey(tile: TileCoord): string {
	return `tiles/${tile.z}/${tile.x}/${tile.y}`;
}
