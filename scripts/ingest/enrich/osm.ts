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

/** Punto de agua con coordenadas y posición sobre el track (SPECS_V3 §5). */
export interface WaterPointGeo {
	name: string | null;
	kind: 'fuente' | 'manantial';
	lat: number;
	lon: number;
	/** km acumulado del track del punto más cercano. */
	km: number;
	/** Distancia al track en metros. */
	dist_m: number;
}

export type PoiType = 'mirador' | 'cumbre' | 'patrimonio' | 'refugio' | 'otro';

/** Punto de interés de OSM cercano al track (SPECS_V3 §5/§6). */
export interface OsmPoi {
	name: string;
	type: PoiType;
	lat: number;
	lon: number;
}

export interface PoiGeo extends OsmPoi {
	km: number;
	dist_m: number;
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

/**
 * Consulta por bbox: fuentes/manantiales y puntos de interés (nodos) y
 * bosques (ways con geometría). Los POIs son los tipos geolocalizables que
 * OSM publica con fiabilidad (miradores, cumbres, patrimonio, refugios):
 * FEMECV no ofrece POIs por el recorrido (ver SPECS_V3 §13).
 */
export function overpassQuery(bbox: [number, number, number, number]): string {
	const [minLon, minLat, maxLon, maxLat] = bbox;
	const bb = `${minLat},${minLon},${maxLat},${maxLon}`;
	return `[out:json][timeout:120];
(
	node["amenity"="drinking_water"](${bb});
	node["natural"="spring"](${bb});
	node["tourism"="viewpoint"](${bb});
	node["natural"="peak"](${bb});
	node["tourism"="alpine_hut"](${bb});
	node["amenity"="shelter"](${bb});
	node["historic"](${bb});
);
out body;
(
	way["natural"="wood"](${bb});
	way["landuse"="forest"](${bb});
);
out geom;`;
}

/** Clasifica un nodo OSM como POI por sus etiquetas, o null si no aplica. */
function poiTypeOf(tags: Record<string, string>): PoiType | null {
	if (tags.tourism === 'viewpoint') return 'mirador';
	if (tags.natural === 'peak') return 'cumbre';
	if (tags.tourism === 'alpine_hut' || tags.amenity === 'shelter') return 'refugio';
	if (tags.historic) return 'patrimonio';
	return null;
}

export function parseOverpass(payload: unknown): {
	water: OsmWaterNode[];
	pois: OsmPoi[];
	woods: OsmWoodPolygon[];
} {
	const elements = (payload as { elements?: OverpassElement[] }).elements;
	if (!Array.isArray(elements)) {
		throw new Error('Respuesta de Overpass sin elements');
	}
	const water: OsmWaterNode[] = [];
	const pois: OsmPoi[] = [];
	const woods: OsmWoodPolygon[] = [];
	for (const el of elements) {
		if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
			const tags = el.tags ?? {};
			if (tags.amenity === 'drinking_water' || tags.natural === 'spring') {
				water.push({
					lat: el.lat,
					lon: el.lon,
					name: tags.name ?? null,
					kind: tags.natural === 'spring' ? 'manantial' : 'fuente'
				});
				continue;
			}
			const type = poiTypeOf(tags);
			// Un POI sin nombre no aporta (no se inventa): se omite.
			if (type && tags.name) pois.push({ name: tags.name, type, lat: el.lat, lon: el.lon });
		} else if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 4) {
			const ring = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
			const first = ring[0];
			const last = ring[ring.length - 1];
			// Solo anillos cerrados (polígonos); las líneas abiertas no son bosque.
			if (first[0] === last[0] && first[1] === last[1]) woods.push({ ring });
		}
	}
	return { water, pois, woods };
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

/** Fuentes a ≤100 m del track, con coordenadas, para pintarlas (SPECS_V3 §5). */
export function waterPointsGeoAlongTrack(
	water: OsmWaterNode[],
	track: Position[]
): WaterPointGeo[] {
	const found: WaterPointGeo[] = [];
	for (const node of water) {
		const { meters, km } = minDistanceToTrack([node.lon, node.lat], track);
		if (meters > WATER_BUFFER_M) continue;
		found.push({
			name: node.name,
			kind: node.kind,
			lat: node.lat,
			lon: node.lon,
			km: Math.round(km * 10) / 10,
			dist_m: Math.round(meters)
		});
	}
	return found.sort((a, b) => a.km - b.km);
}

const POI_BUFFER_M = 150;

/** POIs de OSM a ≤150 m del track, con coordenadas y posición (SPECS_V3 §5). */
export function poisAlongTrack(pois: OsmPoi[], track: Position[]): PoiGeo[] {
	const found: PoiGeo[] = [];
	for (const poi of pois) {
		const { meters, km } = minDistanceToTrack([poi.lon, poi.lat], track);
		if (meters > POI_BUFFER_M) continue;
		found.push({ ...poi, km: Math.round(km * 10) / 10, dist_m: Math.round(meters) });
	}
	return found.sort((a, b) => a.km - b.km);
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
