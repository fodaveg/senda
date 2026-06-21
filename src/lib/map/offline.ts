/**
 * Descarga de tiles del IGN para uso offline (SPECS_V2 §11, SPECS_V3.5 §3).
 * Reutilizado por la ficha (una ruta) y por la descarga por lote (varias). Solo
 * baja lo que falte; respeta el tope de tiles por bbox (cortesía con el IGN,
 * ver tileListForBbox). La red y el almacén son los del proyecto.
 */

import { tileListForBbox, ignTileUrl, tileStoreKey } from './tiles';
import { getStoredBinary, storeBinary } from '$lib/catalog/store';

/**
 * Descarga los tiles del bbox que aún no estén en el almacén local. Llama a
 * `onProgress(done, total)` y devuelve el total de tiles del bbox.
 */
export async function downloadTilesForBbox(
	bbox: [number, number, number, number],
	onProgress?: (done: number, total: number) => void
): Promise<number> {
	const tiles = tileListForBbox(bbox);
	let done = 0;
	for (const tile of tiles) {
		if ((await getStoredBinary(tileStoreKey(tile))) === null) {
			const response = await fetch(ignTileUrl(tile.z, tile.x, tile.y));
			if (!response.ok) throw new Error(`IGN respondió ${response.status}`);
			await storeBinary(tileStoreKey(tile), await response.arrayBuffer());
		}
		done++;
		onProgress?.(done, tiles.length);
	}
	return tiles.length;
}
