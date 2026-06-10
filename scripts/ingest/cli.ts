/**
 * CLI de ingesta (SPEC.md §3): data/gpx/*.gpx + data/routes/_manual/<id>.json
 * → data/routes/<id>.json validado.
 *
 * Uso:
 *   npm run ingest             # procesa todos los GPX
 *   npm run ingest -- pr-cv-77 # solo los ids indicados
 *
 * Falla (exit 1) con error claro si falta el fichero manual, el GPX está
 * corrupto o la validación zod no pasa. No escribe salidas parciales.
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildRoute, IngestError, parseManual } from './build';
import { parseGpx } from './gpx';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GPX_DIR = path.join(ROOT, 'data/gpx');
const MANUAL_DIR = path.join(ROOT, 'data/routes/_manual');
const OUT_DIR = path.join(ROOT, 'data/routes');

function ingestOne(id: string): string {
	const gpxPath = path.join(GPX_DIR, `${id}.gpx`);
	const manualPath = path.join(MANUAL_DIR, `${id}.json`);

	if (!fs.existsSync(gpxPath)) {
		throw new IngestError(id, `no existe ${path.relative(ROOT, gpxPath)}`);
	}
	if (!fs.existsSync(manualPath)) {
		throw new IngestError(
			id,
			`falta ${path.relative(ROOT, manualPath)} con los metadatos no derivables ` +
				`(obligatorios: name, type, sources)`
		);
	}

	const summary = parseGpx(fs.readFileSync(gpxPath, 'utf8'), `${id}.gpx`);
	let rawManual: unknown;
	try {
		rawManual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
	} catch (error) {
		throw new IngestError(
			id,
			`JSON manual ilegible: ${error instanceof Error ? error.message : error}`
		);
	}
	const route = buildRoute(id, summary, parseManual(id, rawManual));

	const outPath = path.join(OUT_DIR, `${id}.json`);
	fs.writeFileSync(outPath, JSON.stringify(route, null, '\t') + '\n');
	return `✓ ${id}: ${route.distance_km} km, +${route.ascent_m ?? '?'} m / −${route.descent_m ?? '?'} m, ${summary.points} puntos → ${path.relative(ROOT, outPath)}`;
}

const requested = process.argv.slice(2);
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
for (const id of ids) {
	try {
		console.log(ingestOne(id));
	} catch (error) {
		failures.push(error instanceof Error ? error.message : String(error));
	}
}

if (failures.length > 0) {
	console.error(`\n${failures.length} ruta(s) con errores:\n`);
	for (const failure of failures) console.error(`✗ ${failure}\n`);
	process.exit(1);
}
console.log(`\n${ids.length} ruta(s) ingeridas sin errores.`);
