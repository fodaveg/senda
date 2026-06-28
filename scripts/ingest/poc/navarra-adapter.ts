/**
 * Adaptador de ingesta — NAVARRA (rebanada vertical V5-1).
 *
 * Demuestra el modelo acordado de extremo a extremo para una CCAA distinta de la
 * CV: toma la fuente OFICIAL pública de la federación navarra (FNDME, que delega
 * en MiSendaFEDME) y produce objetos `Route` **válidos contra el esquema zod**,
 * con `federacion`/`comunidad`/`capabilities` para que la ficha pinte guardas en
 * los bloques que la fuente no publica (MIDE, agua, fauna…).
 *
 * Capas (modelo: regional primero, nacional de respaldo):
 *   - Existencia + matrícula + ficha + GPX → MiSendaFEDME (`ccaa=nc`).
 *   - Estado → presencia en la fuente oficial ≈ "en vigor" (homologado). La lista
 *     fina (homologado/rehomologado/baja) vive en deportenavarra.es [pendiente].
 *   - Geometría → GPX de MiSendaFEDME en esta PoC; en producción CNIG/IDENA (CC-BY)
 *     unida por matrícula [licencia a confirmar].
 *
 * No toca el catálogo en producción. Salida de muestra:
 *   scripts/ingest/poc/navarra-routes.sample.json
 * Uso:  npx tsx scripts/ingest/poc/navarra-adapter.ts
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Route, RouteType } from '../../../src/lib/types';
import { routeSchema } from '../../../src/lib/data/schema';
import { FEDERATIONS } from '../../../src/lib/data/federation';

const UA = 'senda-poc-navarra/0.1 (proyecto personal; contacto: fodaveg@fodaveg.net)';
const BASE = 'https://misendafedme.es/buscador-de-senderos';
const FILES = 'https://misendafedme.es';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'navarra-routes.sample.json');
const FNDME = FEDERATIONS.FNDME;

interface MapaEtapa {
	matricula: string;
	codi_matricula: string;
	titulo: string;
	permalink: string;
	id: string;
	arxiu: string;
	gr_parent_titulo: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getText(url: string): Promise<string> {
	const res = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
	return res.text();
}

async function fetchCatalog(): Promise<MapaEtapa[]> {
	const res = await fetch(`${BASE}/inc/buscar_etapas_mapa.php`, {
		method: 'POST',
		headers: {
			'User-Agent': UA,
			'X-Requested-With': 'XMLHttpRequest',
			Referer: `${BASE}/`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ ccaa: 'nc', pagedArg: '' }).toString()
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} en buscar_etapas_mapa.php`);
	return (await res.json()) as MapaEtapa[];
}

/** kebab-case namespaced por federación: "GR 11. Etapa 1" → "na-gr-11-etapa-1". */
function slugId(matricula: string): string {
	const s = matricula
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	return `na-${s}`;
}

function pictoNum(html: string, picto: string): number | null {
	const m = html.match(new RegExp(`${picto}\\.svg"[^>]*>\\s*([\\d.,]+)`, 'i'));
	return m ? Number(m[1].replace(',', '.')) : null;
}

/** "02 h 55 min" → 175; "42 min" → 42. */
function parseTiempo(html: string): number | null {
	const m = html.match(/tiempoida\.svg"[^>]*>\s*([^<]{1,14})/i);
	if (!m) return null;
	const t = m[1];
	const h = Number(t.match(/(\d+)\s*h/i)?.[1] ?? 0);
	const min = Number(t.match(/(\d+)\s*min/i)?.[1] ?? 0);
	const total = h * 60 + min;
	return total > 0 ? total : null;
}

function recorrido(html: string): boolean | null {
	if (/recorridocircular\.svg/i.test(html)) return true;
	if (/recorridolineal\.svg/i.test(html)) return false;
	return null;
}

function haversine(a: [number, number], b: [number, number]): number {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b[0] - a[0]);
	const dLon = toRad(b[1] - a[1]);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

interface Geom {
	start: { lat: number; lon: number };
	end: { lat: number; lon: number };
	distance_km: number;
	ascent_m: number;
	descent_m: number;
	bbox: [number, number, number, number];
}

/** Geometría derivada del GPX (puntos + elevación). */
function parseGpx(xml: string): Geom | null {
	const pts: Array<[number, number]> = [];
	const eles: number[] = [];
	const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml))) {
		pts.push([Number(m[1]), Number(m[2])]);
		const ele = m[3].match(/<ele>([-\d.]+)<\/ele>/);
		eles.push(ele ? Number(ele[1]) : NaN);
	}
	if (pts.length < 2) return null;
	let length = 0;
	for (let i = 1; i < pts.length; i++) length += haversine(pts[i - 1], pts[i]);
	let ascent = 0;
	let descent = 0;
	for (let i = 1; i < eles.length; i++) {
		const d = eles[i] - eles[i - 1];
		if (!Number.isFinite(d)) continue;
		if (d > 0) ascent += d;
		else descent += -d;
	}
	const lats = pts.map((p) => p[0]);
	const lons = pts.map((p) => p[1]);
	return {
		start: { lat: pts[0][0], lon: pts[0][1] },
		end: { lat: pts[pts.length - 1][0], lon: pts[pts.length - 1][1] },
		distance_km: Math.round((length / 1000) * 10) / 10,
		ascent_m: Math.round(ascent),
		descent_m: Math.round(descent),
		bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
	};
}

/** Construye un Route (modelo multi-federación) a partir de una etapa + ficha + GPX. */
function buildRoute(e: MapaEtapa, html: string, geom: Geom): Route {
	const fecha = new Date().toISOString().slice(0, 10);
	const longitud = pictoNum(html, 'longitud');
	const route: Route = {
		id: slugId(e.matricula),
		name: e.titulo,
		type: e.codi_matricula as RouteType,
		// Presencia en la fuente oficial de la federación ≈ homologado / en vigor.
		status: 'homologado',
		status_detail: null,
		// La fuente no publica municipio/comarca por ruta (capability descripcion=false).
		municipality: null,
		zone: null,
		aemet_municipio: null,
		start: { lat: geom.start.lat, lon: geom.start.lon, name: null },
		end: geom.end,
		distance_km: longitud && longitud > 0 ? longitud : geom.distance_km,
		ascent_m: geom.ascent_m,
		descent_m: geom.descent_m,
		circular: recorrido(html),
		difficulty_mide: null, // capability mide=false → guarda en la ficha
		est_duration_min: parseTiempo(html),
		water_points: [], // capability agua=false → guarda
		water_points_geo: [],
		pois: [],
		escape_routes: [], // capability escapes=false → guarda
		highlights: [],
		best_season: [],
		best_start_time: null,
		shade_ratio: null,
		gpx: `${e.id}.gpx`,
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: geom.bbox,
		sources: [
			`Existencia y ficha: MiSendaFEDME (FNDME) ${e.permalink} (consulta ${fecha})`,
			`Geometría: GPX MiSendaFEDME ${FILES}${e.arxiu} (licencia a confirmar; en producción CNIG/IDENA CC-BY)`,
			`Estado: presencia en la fuente oficial de la federación ≈ en vigor`
		],
		federacion: FNDME.id,
		comunidad: FNDME.comunidad,
		capabilities: FNDME.capabilities
	};
	return route;
}

async function main() {
	console.log('Adaptador Navarra — fuente oficial FNDME (MiSendaFEDME, ccaa=nc)…');
	const etapas = await fetchCatalog();
	console.log(`  catálogo: ${etapas.length} etapas`);

	// Muestra: hasta 2 por tipo (GR/PR/SL) → ficha + GPX + Route validado.
	const muestra: MapaEtapa[] = [];
	for (const tipo of ['GR', 'PR', 'SL'])
		muestra.push(...etapas.filter((e) => e.codi_matricula === tipo).slice(0, 2));

	const routes: Route[] = [];
	const errores: Array<{ matricula: string; error: string }> = [];
	for (const e of muestra) {
		try {
			await sleep(400);
			const html = await getText(e.permalink);
			await sleep(400);
			const xml = await getText(`${FILES}${e.arxiu}`);
			const geom = parseGpx(xml);
			if (!geom) throw new Error('GPX sin geometría suficiente');
			const route = buildRoute(e, html, geom);
			// Validación REAL contra el esquema de producción: lanza si no cumple.
			routeSchema.parse(route);
			routes.push(route);
			console.log(`  ✓ ${route.id} (${route.distance_km} km, +${route.ascent_m} m)`);
		} catch (err) {
			errores.push({ matricula: e.matricula, error: String(err) });
			console.log(`  ✗ ${e.matricula}: ${err}`);
		}
	}

	writeFileSync(
		OUT,
		JSON.stringify(
			{
				generado: new Date().toISOString(),
				federacion: FNDME,
				total_catalogo: etapas.length,
				validadas: routes.length,
				errores,
				rutas: routes
			},
			null,
			2
		) + '\n'
	);
	console.log(`\n${routes.length}/${muestra.length} rutas válidas contra el esquema.`);
	console.log(`Muestra → ${OUT}`);
	if (errores.length) process.exitCode = 1;
}

main().catch((err) => {
	console.error('Adaptador fallido:', err);
	process.exit(1);
});
