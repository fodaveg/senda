/**
 * CLI de ingesta (SPEC.md §3, SPECS_V2 §4): data/gpx/*.gpx +
 * _manual/<id>.json (opcional) + _crawled/<id>.json (opcional)
 * → data/routes/<id>.json validado. Hace falta al menos una de las dos
 * capas de metadatos.
 *
 * Uso:
 *   npm run ingest                # procesa todos los GPX
 *   npm run ingest -- pr-cv-77    # solo los ids indicados
 *   npm run ingest -- --lenient   # no falla por rutas individuales con error
 *                                   (catálogo masivo tras ingest:crawl)
 *
 * En modo estricto (por defecto) falla (exit 1) con error claro si faltan
 * metadatos, el GPX está corrupto o la validación zod no pasa. No escribe
 * salidas parciales.
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildRoute, IngestError, parseCrawled, parseEnriched, parseManual } from './build';
import { parseGpx } from './gpx';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GPX_DIR = path.join(ROOT, 'data/gpx');
const MANUAL_DIR = path.join(ROOT, 'data/routes/_manual');
const CRAWLED_DIR = path.join(ROOT, 'data/routes/_crawled');
const ENRICHED_DIR = path.join(ROOT, 'data/routes/_enriched');
const OUT_DIR = path.join(ROOT, 'data/routes');

function readJson(id: string, filePath: string, kind: string): unknown {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (error) {
		throw new IngestError(
			id,
			`JSON ${kind} ilegible: ${error instanceof Error ? error.message : error}`
		);
	}
}

function ingestOne(id: string): string {
	const gpxPath = path.join(GPX_DIR, `${id}.gpx`);
	const manualPath = path.join(MANUAL_DIR, `${id}.json`);
	const crawledPath = path.join(CRAWLED_DIR, `${id}.json`);
	const enrichedPath = path.join(ENRICHED_DIR, `${id}.json`);

	if (!fs.existsSync(gpxPath)) {
		throw new IngestError(id, `no existe ${path.relative(ROOT, gpxPath)}`);
	}
	const manual = fs.existsSync(manualPath)
		? parseManual(id, readJson(id, manualPath, 'manual'))
		: null;
	const crawled = fs.existsSync(crawledPath)
		? parseCrawled(id, readJson(id, crawledPath, 'crawleado'))
		: null;
	if (!manual && !crawled) {
		throw new IngestError(
			id,
			`faltan metadatos: ni _manual/${id}.json ni _crawled/${id}.json ` +
				`(el manual exige name, type y sources)`
		);
	}

	const enriched = fs.existsSync(enrichedPath)
		? parseEnriched(id, readJson(id, enrichedPath, 'enriquecido'))
		: null;

	const summary = parseGpx(fs.readFileSync(gpxPath, 'utf8'), `${id}.gpx`);
	const route = buildRoute(id, summary, manual, crawled, enriched);

	const outPath = path.join(OUT_DIR, `${id}.json`);
	fs.writeFileSync(outPath, JSON.stringify(route, null, '\t') + '\n');
	return `✓ ${id}: ${route.distance_km} km, +${route.ascent_m ?? '?'} m / −${route.descent_m ?? '?'} m, ${summary.points} puntos`;
}

const args = process.argv.slice(2);
const lenient = args.includes('--lenient');
const requested = args.filter((a) => !a.startsWith('--'));

const ids =
	requested.length > 0
		? requested
		: fs
				.readdirSync(GPX_DIR)
				.filter((f) => f.endsWith('.gpx'))
				.map((f) => f.replace(/\.gpx$/, ''))
				.sort();

if (ids.length === 0) {
	console.error(`No hay GPX en ${path.relative(ROOT, GPX_DIR)}. Nada que ingerir.`);
	process.exit(1);
}

const failures: string[] = [];
let ok = 0;
for (const id of ids) {
	try {
		const line = ingestOne(id);
		ok++;
		if (ids.length <= 20) console.log(line);
		else if (ok % 100 === 0) console.log(`  …${ok} rutas ingeridas`);
	} catch (error) {
		failures.push(error instanceof Error ? error.message : String(error));
	}
}

console.log(`\n${ok}/${ids.length} ruta(s) ingeridas.`);
if (failures.length > 0) {
	console.error(`\n${failures.length} ruta(s) con errores:\n`);
	for (const failure of failures) console.error(`✗ ${failure}\n`);
	if (!lenient) process.exit(1);
	console.error('(modo --lenient: los errores anteriores no bloquean el catálogo)');
}
