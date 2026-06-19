/**
 * Extremos del track para pintar pins de inicio y fin en el mapa
 * (SPECS_V3 §5). Puro y testeable: deriva los puntos del propio GeoJSON,
 * sin inventar nada. Detecta rutas circulares por proximidad de los
 * extremos para no duplicar el pin (inicio = fin).
 */

import type { FeatureCollection } from 'geojson';
import { trackPositions } from '$lib/geo/gpx';
import { haversineMeters } from '$lib/geo/distance';

export interface TrackEndpoints {
	/** Punto de inicio [lon, lat]. */
	start: [number, number];
	/** Punto final [lon, lat]. */
	end: [number, number];
	/** true si inicio y fin coinciden (ruta circular): un único pin. */
	circular: boolean;
}

/** Umbral (m) para considerar que inicio y fin son el mismo punto. */
const CIRCULAR_THRESHOLD_M = 50;

/**
 * Inicio y fin del track, o `null` si no hay coordenadas suficientes.
 * No asume nada del modelo de ruta: usa solo la geometría.
 */
export function trackEndpoints(collection: FeatureCollection): TrackEndpoints | null {
	const positions = trackPositions(collection);
	if (positions.length < 2) return null;
	const first = positions[0];
	const last = positions[positions.length - 1];
	const start: [number, number] = [first[0], first[1]];
	const end: [number, number] = [last[0], last[1]];
	return { start, end, circular: haversineMeters(start, end) <= CIRCULAR_THRESHOLD_M };
}
