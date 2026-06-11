/**
 * Enriquecimiento desde OpenStreetMap (SPECS_V2 §12): fuentes de agua y
 * sombra estimada por cobertura arbórea. Parsers y geometría puros; la
 * red y los ficheros viven en enrich-cli.ts.
 *
 * Honestidad: todo lo derivado se cita como "OSM (no verificado en
 * campo)". La sombra es una estimación a la baja (solo polígonos cerrados
 * de bosque; las relaciones multipolígono se omiten): ante la duda, la
 * app recomienda más protección, nunca menos (fail-safe).
 */

import type { Position } from 'geojson';
import { haversineMeters } from '../../../src/lib/geo/distance';

export interface OsmWaterNode {
	lat: number;
	lon: number;
	name: string | null;
	kind: 'fuente' | 'manantial';
}

export interface OsmWoodPolygon {
	/** Anillo cerrado [lon, lat][]. */
	ring: Array<[number, number]>;
}

interface OverpassElement {
	type: string;
	lat?: number;
	lon?: number;
	tags?: Record<string, string>;
	geometry?: Array<{ lat: number; lon: number }>;
}

/** Consulta por bbox: fuentes/manantiales (nodos) y bosques (ways con geometría). */
export function overpassQuery(bbox: [number, number, number, number]): string {
	const [minLon, minLat, maxLon, maxLat] = bbox;
	const bb = `${minLat},${minLon},${maxLat},${maxLon}`;
	return `[out:json][timeout:60];
(
	node["amenity"="drinking_water"](${bb});
	node["natural"="spring"](${bb});
);
out body;
(
	way["natural"="wood"](${bb});
	way["landuse"="forest"](${bb});
);
out geom;`;
}

export function parseOverpass(payload: unknown): {
	water: OsmWaterNode[];
	woods: OsmWoodPolygon[];
} {
	const elements = (payload as { elements?: OverpassElement[] }).elements;
	if (!Array.isArray(elements)) {
		throw new Error('Respuesta de Overpass sin elements');
	}
	const water: OsmWaterNode[] = [];
	const woods: OsmWoodPolygon[] = [];
	for (const el of elements) {
		if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
			water.push({
				lat: el.lat,
				lon: el.lon,
				name: el.tags?.name ?? null,
				kind: el.tags?.natural === 'spring' ? 'manantial' : 'fuente'
			});
		} else if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4) {
			const ring = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
			const first = ring[0];
			const last = ring[ring.length - 1];
			// Solo anillos cerrados (polígonos); las líneas abiertas no son bosque.
			if (first[0] === last[0] && first[1] === last[1]) woods.push({ ring });
		}
	}
	return { water, woods };
}

/** Distancia mínima de un punto al track (sobre los vértices muestreados). */
function minDistanceToTrack(
	point: [number, number],
	track: Position[]
): {
	meters: number;
	km: number;
} {
	let best = Infinity;
	let bestIndex = 0;
	for (let i = 0; i < track.length; i++) {
		const d = haversineMeters(point, [track[i][0], track[i][1]]);
		if (d < best) {
			best = d;
			bestIndex = i;
		}
	}
	// km acumulado aproximado hasta el vértice más cercano.
	let cumulative = 0;
	for (let i = 1; i <= bestIndex; i++) {
		cumulative += haversineMeters([track[i - 1][0], track[i - 1][1]], [track[i][0], track[i][1]]);
	}
	return { meters: best, km: cumulative / 1000 };
}

const WATER_BUFFER_M = 100;

/** Fuentes a ≤100 m del track, como textos citables ordenados por km. */
export function waterPointsAlongTrack(water: OsmWaterNode[], track: Position[]): string[] {
	const found: Array<{ km: number; text: string }> = [];
	for (const node of water) {
		const { meters, km } = minDistanceToTrack([node.lon, node.lat], track);
		if (meters > WATER_BUFFER_M) continue;
		const label = node.kind === 'manantial' ? 'Manantial' : 'Fuente';
		found.push({
			km,
			text: `${label}${node.name ? ` "${node.name}"` : ''} (km ${km.toFixed(1)}, a ${Math.round(meters)} m del track; OSM, no verificado en campo)`
		});
	}
	return found.sort((a, b) => a.km - b.km).map((f) => f.text);
}

/** Ray casting punto-en-polígono sobre [lon, lat]. */
export function pointInRing(point: [number, number], ring: Array<[number, number]>): boolean {
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

const SHADE_SAMPLE_STEP = 5;

/**
 * Proporción del track bajo arbolado (0–1), muestreando 1 de cada 5
 * puntos. null si no hay bosques en el bbox (no se distingue "sin bosque"
 * de "sin datos OSM": mejor null que un 0 afirmado).
 */
export function shadeRatioOfTrack(woods: OsmWoodPolygon[], track: Position[]): number | null {
	if (woods.length === 0) return null;
	let sampled = 0;
	let shaded = 0;
	for (let i = 0; i < track.length; i += SHADE_SAMPLE_STEP) {
		sampled++;
		const point: [number, number] = [track[i][0], track[i][1]];
		if (woods.some((wood) => pointInRing(point, wood.ring))) shaded++;
	}
	if (sampled === 0) return null;
	return Math.round((shaded / sampled) * 100) / 100;
}

/** Rutas alternativas: las 3 con inicio más cercano dentro de 15 km. */
export function nearestAlternatives(
	routeId: string,
	start: { lat: number; lon: number },
	all: Array<{ id: string; start: { lat: number; lon: number } }>
): string[] {
	const MAX_M = 15000;
	return all
		.filter((r) => r.id !== routeId)
		.map((r) => ({
			id: r.id,
			d: haversineMeters([start.lon, start.lat], [r.start.lon, r.start.lat])
		}))
		.filter((r) => r.d <= MAX_M)
		.sort((a, b) => a.d - b.d)
		.slice(0, 3)
		.map((r) => r.id);
}
