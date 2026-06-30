/**
 * CLI de ingesta de Navarra (FNDME) — red + escritura.
 *
 * Flujo: catálogo MiSendaFEDME (`ccaa=nc`) → agrupa en senderos → por sendero,
 * geometría oficial de **IDENA WFS** (CC-BY, EPSG:25830) → reproyecta → escribe
 * `data/routes/na-*.json` (validado contra el esquema) + `data/gpx/na-*.gpx`.
 *
 * Honestidad y robustez: cada sendero se valida por separado; los que no tienen
 * capa en IDENA o no validan se registran en `errores` y NO se escriben (nunca
 * dato a medias). Tras esto, enriquecer con OSM como el resto: `npm run ingest:enrich`.
 *
 * Uso: `npm run ingest:navarra [-- --limit N]`
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { FeatureCollection } from 'geojson';
import { routeSchema } from '../../../src/lib/data/schema';
import { enrichedSchema } from '../schema';
import type { Route } from '../../../src/lib/types';
import {
	applyEnrichment,
	buildRoute,
	geojsonToSegments,
	groupSenderos,
	segmentsToGpx,
	trackSummary,
	type MapaEtapa,
	type Sendero
} from './navarra';

const UA = 'senda-navarra/0.1 (proyecto personal; contacto: fodaveg@fodaveg.net)';
const MISENDA = 'https://misendafedme.es/buscador-de-senderos';
const IDENA = 'https://idena.navarra.es/ogc/wfs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const ROUTES_DIR = join(ROOT, 'data/routes');
const ENRICHED_DIR = join(ROOT, 'data/routes/_enriched');
const GPX_DIR = join(ROOT, 'data/gpx');
const REPORT = join(ROOT, 'scripts/ingest/navarra/navarra-report.json');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fusiona `_enriched/na-*.json` (escrito por `ingest:enrich`) en las rutas de
 * Navarra ya existentes. Las `na-*` no pasan por la build normal (no tienen
 * `_crawled`), así que este paso hace el merge equivalente, idempotente.
 */
function mergeEnriched(): void {
	const ids = readdirSync(ROUTES_DIR)
		.filter((f) => f.startsWith('na-') && f.endsWith('.json'))
		.map((f) => f.replace(/\.json$/, ''));
	let merged = 0;
	for (const id of ids) {
		const enrPath = join(ENRICHED_DIR, `${id}.json`);
		if (!existsSync(enrPath)) continue;
		const enriched = enrichedSchema.parse(JSON.parse(readFileSync(enrPath, 'utf8')));
		const route = JSON.parse(readFileSync(join(ROUTES_DIR, `${id}.json`), 'utf8')) as Route;
		const next = applyEnrichment(route, enriched);
		const parsed = routeSchema.safeParse(next);
		if (!parsed.success) {
			console.log(`✗ ${id}: enriquecido no valida: ${z.prettifyError(parsed.error)}`);
			continue;
		}
		writeFileSync(join(ROUTES_DIR, `${id}.json`), JSON.stringify(next, null, '\t') + '\n');
		const w = next.water_points_geo.length;
		const p = next.pois.length;
		console.log(`✓ ${id}: ${w} fuentes, ${p} POIs`);
		merged++;
	}
	console.log(`\nMerge enriquecido: ${merged}/${ids.length} rutas de Navarra.`);
}

async function fetchCatalog(): Promise<MapaEtapa[]> {
	const res = await fetch(`${MISENDA}/inc/buscar_etapas_mapa.php`, {
		method: 'POST',
		headers: {
			'User-Agent': UA,
			'X-Requested-With': 'XMLHttpRequest',
			Referer: `${MISENDA}/`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({ ccaa: 'nc', pagedArg: '' }).toString()
	});
	if (!res.ok) throw new Error(`MiSenda HTTP ${res.status}`);
	return (await res.json()) as MapaEtapa[];
}

async function fetchIdena(layer: string): Promise<FeatureCollection | null> {
	const url =
		`${IDENA}?service=WFS&version=2.0.0&request=GetFeature` +
		`&typeNames=IDENA:${layer}&outputFormat=application/json`;
	const res = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!res.ok) return null;
	const text = await res.text();
	// IDENA devuelve XML de excepción si la capa no existe.
	if (!text.trimStart().startsWith('{')) return null;
	const json = JSON.parse(text) as FeatureCollection;
	return Array.isArray(json.features) && json.features.length > 0 ? json : null;
}

async function ingestSendero(
	s: Sendero,
	date: string
): Promise<{ ok: true; id: string } | { ok: false; id: string; reason: string }> {
	const fc = await fetchIdena(s.idenaLayer);
	if (!fc) return { ok: false, id: s.id, reason: `sin geometría en IDENA (${s.idenaLayer})` };
	const segments = geojsonToSegments(fc);
	const summary = trackSummary(segments);
	if (!summary) return { ok: false, id: s.id, reason: 'geometría vacía tras reproyectar' };

	const route = buildRoute(s, summary, date);
	const parsed = routeSchema.safeParse(route);
	if (!parsed.success) {
		return { ok: false, id: s.id, reason: `no valida: ${z.prettifyError(parsed.error)}` };
	}
	writeFileSync(join(ROUTES_DIR, `${s.id}.json`), JSON.stringify(route, null, '\t') + '\n');
	writeFileSync(join(GPX_DIR, `${s.id}.gpx`), segmentsToGpx(segments, route.name));
	return { ok: true, id: s.id };
}

async function main() {
	// Modo merge: integra el enriquecimiento OSM ya generado, sin tocar la red.
	if (process.argv.includes('--merge-enriched')) {
		mergeEnriched();
		return;
	}

	const limitArg = process.argv.indexOf('--limit');
	const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;
	const date = new Date().toISOString().slice(0, 10);

	console.log('Ingesta Navarra (FNDME) — MiSenda ccaa=nc + IDENA WFS (CC-BY)…');
	mkdirSync(ROUTES_DIR, { recursive: true });
	mkdirSync(GPX_DIR, { recursive: true });

	const etapas = await fetchCatalog();
	const senderos = groupSenderos(etapas).slice(0, limit);
	console.log(`${etapas.length} etapas → ${senderos.length} senderos.`);

	const validadas: string[] = [];
	const errores: { id: string; reason: string }[] = [];
	for (const s of senderos) {
		try {
			const r = await ingestSendero(s, date);
			if (r.ok) {
				validadas.push(r.id);
				console.log(`✓ ${r.id} (${s.matricula})`);
			} else {
				errores.push({ id: r.id, reason: r.reason });
				console.log(`– ${r.id}: ${r.reason}`);
			}
		} catch (e) {
			errores.push({ id: s.id, reason: String(e) });
			console.log(`✗ ${s.id}: ${e}`);
		}
		await sleep(300); // cortesía con los servidores
	}

	writeFileSync(
		REPORT,
		JSON.stringify({ generado: new Date().toISOString(), validadas, errores }, null, '\t') + '\n'
	);
	console.log(
		`\n${validadas.length}/${senderos.length} senderos ingeridos. Errores: ${errores.length}.`
	);
	console.log('Siguiente: `npm run ingest:enrich` para agua/POIs/sombra de OSM.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
