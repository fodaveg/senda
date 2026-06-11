/**
 * Crawler del portal FEMECV (SPECS_V2 §4): listado completo → ficha por
 * ruta → data/routes/_crawled/<id>.json + descarga del GPX si falta.
 *
 * Uso:
 *   npm run ingest:crawl                # catálogo completo
 *   npm run ingest:crawl -- --limit 10  # solo las 10 primeras (pruebas)
 *   npm run ingest:crawl -- pr-cv-77    # solo los ids indicados
 *
 * Cortesía con el portal: ≥1 s entre peticiones, User-Agent identificable,
 * los GPX ya descargados no se vuelven a pedir. Idempotente: reejecutar
 * refresca estados y añade rutas nuevas sin tocar data/routes/_manual/.
 * Tras el crawl: `npm run ingest -- --lenient` para regenerar el catálogo.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
	FichaParseError,
	parseFicha,
	parseIndexSlugs,
	parseResultCount,
	PORTAL_BASE
} from './crawl';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CRAWLED_DIR = path.join(ROOT, 'data/routes/_crawled');
const GPX_DIR = path.join(ROOT, 'data/gpx');

const USER_AGENT = 'senderos-cv-crawler/0.2 (proyecto personal; contacto: fodaveg@fodaveg.net)';
const RATE_LIMIT_MS = 1000;
const PER_PAGE = 21;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

async function politeFetch(url: string): Promise<Response> {
	const wait = lastRequestAt + RATE_LIMIT_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastRequestAt = Date.now();
	for (let attempt = 1; ; attempt++) {
		try {
			const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
			if (response.ok) return response;
			if (attempt >= 3) throw new Error(`HTTP ${response.status} en ${url}`);
		} catch (error) {
			if (attempt >= 3) {
				throw error instanceof Error ? error : new Error(String(error));
			}
		}
		await sleep(RATE_LIMIT_MS * attempt * 2);
	}
}

async function collectSlugs(): Promise<string[]> {
	const first = await (await politeFetch(`${PORTAL_BASE}/es/senderos/index/1`)).text();
	const total = parseResultCount(first);
	if (total === null) {
		throw new Error('el listado no publica el total de resultados; ¿cambió el portal?');
	}
	const pages = Math.ceil(total / PER_PAGE);
	console.log(`Listado: ${total} rutas en ${pages} páginas.`);

	const slugs = new Set<string>(parseIndexSlugs(first));
	for (let page = 2; page <= pages; page++) {
		const html = await (await politeFetch(`${PORTAL_BASE}/es/senderos/index/${page}`)).text();
		for (const slug of parseIndexSlugs(html)) slugs.add(slug);
		if (page % 10 === 0) console.log(`  …página ${page}/${pages} (${slugs.size} slugs)`);
	}
	return [...slugs].sort();
}

async function crawlOne(slug: string): Promise<{ gpx: 'descargado' | 'existente' | 'sin-gpx' }> {
	const html = await (await politeFetch(`${PORTAL_BASE}/es/sendero/ver/${slug}`)).text();
	const crawled = parseFicha(slug, html, new Date().toISOString());
	fs.writeFileSync(
		path.join(CRAWLED_DIR, `${slug}.json`),
		JSON.stringify(crawled, null, '\t') + '\n'
	);

	const gpxPath = path.join(GPX_DIR, `${slug}.gpx`);
	if (fs.existsSync(gpxPath)) return { gpx: 'existente' };
	if (!crawled.gpx_url) return { gpx: 'sin-gpx' };
	const gpx = await (await politeFetch(crawled.gpx_url)).arrayBuffer();
	fs.writeFileSync(gpxPath, Buffer.from(gpx));
	return { gpx: 'descargado' };
}

async function main(): Promise<void> {
	fs.mkdirSync(CRAWLED_DIR, { recursive: true });
	fs.mkdirSync(GPX_DIR, { recursive: true });

	const args = process.argv.slice(2);
	const limitIndex = args.indexOf('--limit');
	const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) : null;
	const explicitIds = args.filter((a, i) => !a.startsWith('--') && i !== limitIndex + 1);

	let slugs = explicitIds.length > 0 ? explicitIds : await collectSlugs();
	if (limit !== null && Number.isFinite(limit)) slugs = slugs.slice(0, limit);

	const failures: string[] = [];
	let downloaded = 0;
	let withoutGpx = 0;
	for (const [index, slug] of slugs.entries()) {
		try {
			const { gpx } = await crawlOne(slug);
			if (gpx === 'descargado') downloaded++;
			if (gpx === 'sin-gpx') withoutGpx++;
			if ((index + 1) % 25 === 0 || index === slugs.length - 1) {
				console.log(`  …${index + 1}/${slugs.length} fichas`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(
				`${slug}: ${error instanceof FichaParseError ? `parseo — ${message}` : message}`
			);
		}
	}

	console.log(
		`\nCrawl: ${slugs.length - failures.length}/${slugs.length} fichas OK · ` +
			`${downloaded} GPX descargados · ${withoutGpx} rutas sin GPX publicado · ` +
			`${failures.length} errores`
	);
	if (failures.length > 0) {
		console.error('\nErrores:');
		for (const failure of failures) console.error(`✗ ${failure}`);
	}
	console.log('\nSiguiente paso: npm run ingest -- --lenient');
	if (failures.length === slugs.length) process.exit(1);
}

void main();
