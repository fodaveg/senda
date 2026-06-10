/**
 * Parseo de GPX FEMECV: extrae del track los datos derivables
 * (distancia, desniveles acumulados, bounding box, punto de inicio,
 * circularidad). SPEC.md §3. Reutiliza los módulos geo de src/lib.
 */

import { DOMParser } from '@xmldom/xmldom';
import { haversineMeters } from '../../src/lib/geo/distance';
import { gpxToGeoJSON, trackPositions } from '../../src/lib/geo/gpx';

export interface GpxSummary {
	/** Nombre declarado en el GPX, si existe. */
	name: string | null;
	distance_km: number;
	/** null si el track no trae elevaciones. */
	ascent_m: number | null;
	descent_m: number | null;
	start: { lat: number; lon: number };
	bbox: [number, number, number, number];
	/** true si el track termina a menos de CIRCULAR_MAX_GAP_M del inicio. */
	circular: boolean;
	points: number;
}

/** Umbral de histéresis para ignorar ruido barométrico/GPS en el desnivel. */
const ELEVATION_NOISE_M = 3;
/** Distancia máxima inicio-fin para considerar la ruta circular. */
const CIRCULAR_MAX_GAP_M = 200;

export function parseGpx(xml: string, label = 'gpx'): GpxSummary {
	let collection: ReturnType<typeof gpxToGeoJSON>;
	try {
		collection = gpxToGeoJSON(xml, new DOMParser());
	} catch (error) {
		throw new Error(`GPX corrupto (${label}): ${error instanceof Error ? error.message : error}`, {
			cause: error
		});
	}

	const coords = trackPositions(collection);
	if (coords.length < 2) {
		throw new Error(`GPX sin track utilizable (${label}): se esperaban ≥2 puntos de track`);
	}
	let name: string | null = null;
	for (const feature of collection.features) {
		if (typeof feature.properties?.name === 'string') {
			name = feature.properties.name;
			break;
		}
	}

	let distanceM = 0;
	let ascent = 0;
	let descent = 0;
	let hasElevation = false;
	let lastElevation: number | null = null;
	let minLon = Infinity;
	let minLat = Infinity;
	let maxLon = -Infinity;
	let maxLat = -Infinity;

	for (let i = 0; i < coords.length; i++) {
		const [lon, lat, ele] = coords[i];
		minLon = Math.min(minLon, lon);
		minLat = Math.min(minLat, lat);
		maxLon = Math.max(maxLon, lon);
		maxLat = Math.max(maxLat, lat);

		if (i > 0) {
			distanceM += haversineMeters(coords[i - 1] as [number, number], [lon, lat]);
		}

		if (typeof ele === 'number') {
			hasElevation = true;
			if (lastElevation === null) {
				lastElevation = ele;
			} else {
				const delta = ele - lastElevation;
				// Histéresis: solo acumula cuando el cambio supera el ruido.
				if (Math.abs(delta) >= ELEVATION_NOISE_M) {
					if (delta > 0) ascent += delta;
					else descent -= delta;
					lastElevation = ele;
				}
			}
		}
	}

	const first = coords[0];
	const last = coords[coords.length - 1];

	return {
		name,
		distance_km: Math.round((distanceM / 1000) * 10) / 10,
		ascent_m: hasElevation ? Math.round(ascent) : null,
		descent_m: hasElevation ? Math.round(descent) : null,
		start: { lat: first[1], lon: first[0] },
		bbox: [minLon, minLat, maxLon, maxLat],
		circular:
			haversineMeters(first as [number, number], last as [number, number]) <= CIRCULAR_MAX_GAP_M,
		points: coords.length
	};
}
