/**
 * Parseo de GPX FEMECV: extrae del track los datos derivables
 * (distancia, desniveles acumulados, bounding box, punto de inicio,
 * circularidad). SPEC.md §3.
 */

import { gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

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

const EARTH_RADIUS_M = 6371000;

function haversineMeters(a: [number, number], b: [number, number]): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b[1] - a[1]);
	const dLon = toRad(b[0] - a[0]);
	const sinLat = Math.sin(dLat / 2);
	const sinLon = Math.sin(dLon / 2);
	const h = sinLat * sinLat + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLon * sinLon;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** [lon, lat, ele?] según GeoJSON. */
type Position = number[];

function trackCoordinates(xml: string, label: string): { coords: Position[]; name: string | null } {
	let collection: ReturnType<typeof gpx>;
	try {
		// Algunos GPX de FEMECV (CompeGPS) llevan BOM, que rompe el parser XML.
		const doc = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ''), 'text/xml');
		collection = gpx(doc as unknown as Parameters<typeof gpx>[0]);
	} catch (error) {
		throw new Error(`GPX corrupto (${label}): ${error instanceof Error ? error.message : error}`, {
			cause: error
		});
	}

	const coords: Position[] = [];
	let name: string | null = null;
	for (const feature of collection.features) {
		const geometry = feature.geometry;
		if (geometry.type === 'LineString') {
			coords.push(...geometry.coordinates);
		} else if (geometry.type === 'MultiLineString') {
			for (const line of geometry.coordinates) coords.push(...line);
		} else {
			continue;
		}
		if (name === null && typeof feature.properties?.name === 'string') {
			name = feature.properties.name;
		}
	}
	return { coords, name };
}

export function parseGpx(xml: string, label = 'gpx'): GpxSummary {
	const { coords, name } = trackCoordinates(xml, label);
	if (coords.length < 2) {
		throw new Error(`GPX sin track utilizable (${label}): se esperaban ≥2 puntos de track`);
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
