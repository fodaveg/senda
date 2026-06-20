/**
 * Enriquecimiento OSM del catálogo (SPECS_V2 §12):
 *   npm run ingest:enrich [-- <id…>] [--limit N]
 *
 * Por ruta (con bbox y GPX): una consulta Overpass del bbox ampliado →
 * fuentes de agua a ≤100 m del track y sombra estimada por arbolado.
 * Además calcula alternativas por proximidad (local, sin red).
 * Escribe data/routes/_enriched/<id>.json; la ingesta lo merge con
 * prioridad manual > crawleado > enriquecido > derivado.
 *
 * Cortesía con Overpass: 1 petición/2 s, User-Agent identificable, y las
 * rutas ya enriquecidas se saltan (usa --force para refrescar).
 * Tras el enrich: npm run ingest -- --lenient
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseGpx } from '../gpx';
import { gpxToGeoJSON, trackPositions } from '../../../src/lib/geo/gpx';
import { DOMParser } from '@xmldom/xmldom';
import {
	nearestAlternatives,
	overpassQuery,
	parseOverpass,
	poisAlongTrack,
	shadeRatioOfTrack,
	waterPointsAlongTrack,
	waterPointsGeoAlongTrack
} from './osm';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const ROUTES_DIR = path.join(ROOT, 'data/routes');
const GPX_DIR = path.join(ROOT, 'data/gpx');
const ENRICHED_DIR = path.join(ROOT, 'data/routes/_enriched');

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'senderos-cv-enrich/0.2 (proyecto personal; contacto: fodaveg@fodaveg.net)';
const RATE_LIMIT_MS = Number(process.env.OVERPASS_DELAY_MS ?? 2000);
/** Margen del bbox en grados (~1 km) para captar fuentes junto al track. */
const BBOX_PAD = 0.01;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RouteLite {
	id: string;
	start: { lat: number; lon: number };
	bbox: [number, number, number, number] | null;
}

/** ¿El enriquecido de esta ruta ya incluye el campo nuevo water_points_geo? */
function hasGeoEnrichment(id: string): boolean {
	const file = path.join(ENRICHED_DIR, `${id}.json`);
	if (!fs.existsSync(file)) return false;
	try {
		return 'water_points_geo' in JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch {
		return false;
	}
}

function loadRoutes(): RouteLite[] {
	return fs
		.readdirSync(ROUTES_DIR)
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8')) as RouteLite);
}

async function enrichOne(route: RouteLite, all: RouteLite[]): Promise<string> {
	const gpxPath = path.join(GPX_DIR, `${route.id}.gpx`);
	if (!route.bbox || !fs.existsSync(gpxPath)) return 'sin bbox o GPX';
	parseGpx(fs.readFileSync(gpxPath, 'utf8'), `${route.id}.gpx`); // valida
	const xml = fs.readFileSync(gpxPath, 'utf8');
	const track = trackPositions(
		gpxToGeoJSON(xml, new DOMParser() as unknown as globalThis.DOMParser)
	);

	const bbox: [number, number, number, number] = [
		route.bbox[0] - BBOX_PAD,
		route.bbox[1] - BBOX_PAD,
		route.bbox[2] + BBOX_PAD,
		route.bbox[3] + BBOX_PAD
	];
	let response = await fetch(OVERPASS_URL, {
		method: 'POST',
		headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'text/plain' },
		body: overpassQuery(bbox)
	});
	if (response.status === 429) {
		// Throttling: una espera larga y un único reintento.
		await sleep(30000);
		response = await fetch(OVERPASS_URL, {
			method: 'POST',
			headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'text/plain' },
			body: overpassQuery(bbox)
		});
	}
	if (!response.ok) throw new Error(`Overpass respondió ${response.status}`);
	const { water, pois, woods } = parseOverpass(await response.json());

	const enriched = {
		water_points: waterPointsAlongTrack(water, track),
		water_points_geo: waterPointsGeoAlongTrack(water, track),
		pois: poisAlongTrack(pois, track),
		shade_ratio: shadeRatioOfTrack(woods, track),
		alternatives: nearestAlternatives(route.id, route.start, all),
		enriched_at: new Date().toISOString(),
		method:
			'OSM Overpass: fuentes/manantiales a ≤100 m del track (con coordenadas); POIs ' +
			'(mirador/cumbre/patrimonio/refugio) a ≤150 m; sombra = % de puntos del track bajo ' +
			'polígonos natural=wood/landuse=forest (estimación a la baja, multipolígonos omitidos)'
	};
	fs.writeFileSync(
		path.join(ENRICHED_DIR, `${route.id}.json`),
		JSON.stringify(enriched, null, '\t') + '\n'
	);
	return `${enriched.water_points_geo.length} fuentes, ${enriched.pois.length} POIs, sombra ${enriched.shade_ratio ?? 'n/d'}, ${enriched.alternatives.length} alternativas`;
}

async function main(): Promise<void> {
	fs.mkdirSync(ENRICHED_DIR, { recursive: true });
	const args = process.argv.slice(2);
	const force = args.includes('--force');
	const limitIndex = args.indexOf('--limit');
	const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) : null;
	const explicit = args.filter((a, i) => !a.startsWith('--') && i !== limitIndex + 1);

	const all = loadRoutes();
	let targets = explicit.length > 0 ? all.filter((r) => explicit.includes(r.id)) : all;
	if (!force) {
		// Reanudable: se salta solo lo que ya tiene el campo nuevo (water_points_geo).
		// Así un re-enrich para añadir coordenadas/POIs reprocesa solo lo que falta.
		targets = targets.filter((r) => !hasGeoEnrichment(r.id));
	}
	if (limit !== null && Number.isFinite(limit)) targets = targets.slice(0, limit);
	console.log(`Enriqueciendo ${targets.length} rutas (de ${all.length}).`);

	const failures: string[] = [];
	for (const [index, route] of targets.entries()) {
		try {
			const summary = await enrichOne(route, all);
			if ((index + 1) % 25 === 0 || targets.length <= 10) {
				console.log(`  ${index + 1}/${targets.length} ${route.id}: ${summary}`);
			}
		} catch (error) {
			failures.push(`${route.id}: ${error instanceof Error ? error.message : error}`);
		}
		await sleep(RATE_LIMIT_MS);
	}
	console.log(
		`\nEnrich: ${targets.length - failures.length}/${targets.length} OK · ${failures.length} errores`
	);
	for (const failure of failures.slice(0, 10)) console.error(`✗ ${failure}`);
	console.log('\nSiguiente paso: npm run ingest -- --lenient');
	if (failures.length === targets.length && targets.length > 0) process.exit(1);
}

void main();
