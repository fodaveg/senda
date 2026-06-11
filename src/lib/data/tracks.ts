/**
 * Tracks GPX como texto, servidos como estáticos bajo demanda desde
 * static/gpx (copiados de data/gpx en pre-dev/build). Con el catálogo
 * completo (~850 rutas) no se empaquetan en JS ni se precachean; el
 * service worker cachea en runtime los visitados.
 *
 * Orden de resolución: almacén local del catálogo → estáticos del build →
 * catálogo remoto (rutas añadidas por una actualización, que se cachean
 * en el almacén al primer uso).
 */

import { assets } from '$app/paths';
import { getStoredManifest, getStoredTrack, storeFile } from '$lib/catalog/store';
import { DEFAULT_CATALOG_URL } from '$lib/catalog/update';

export async function loadTrackXml(gpxFile: string): Promise<string> {
	if (!/^[a-z0-9-]+\.gpx$/.test(gpxFile)) {
		throw new Error(`Nombre de track no válido: ${gpxFile}`);
	}
	const stored = await getStoredTrack(gpxFile);
	if (stored !== null) return stored;

	const local = await fetch(`${assets}/gpx/${gpxFile}`);
	if (local.ok) return local.text();

	// Ruta llegada por actualización de catálogo: su GPX no está en el build.
	const manifest = await getStoredManifest();
	if (manifest && `gpx/${gpxFile}` in manifest.files) {
		const remote = await fetch(`${DEFAULT_CATALOG_URL}/gpx/${gpxFile}`);
		if (remote.ok) {
			const xml = await remote.text();
			await storeFile(`gpx/${gpxFile}`, xml);
			return xml;
		}
	}
	throw new Error(`No se pudo cargar el track ${gpxFile} (HTTP ${local.status})`);
}
