/**
 * Empaqueta el dataset para GitLab Pages (SPECS_V2 §4): copia
 * data/{routes,gpx,gear,wildlife} a <destino>/ y genera manifest.json con
 * versión monótona, fecha y checksum sha256 por fichero. Lo ejecuta la CI
 * (job pages); también sirve en local para probar el flujo de
 * actualización.
 *
 * Uso: node scripts/publish/build-catalog.mjs [destino] (def. public/catalog)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.resolve(root, process.argv[2] ?? 'public/catalog');

/** Versión monótona: epoch en segundos de la publicación. */
const version = Math.floor(Date.now() / 1000);

const sets = [
	{ from: 'data/routes', to: 'routes', filter: (f) => f.endsWith('.json') },
	{ from: 'data/gpx', to: 'gpx', filter: (f) => f.endsWith('.gpx') },
	{ from: 'data/gear', to: 'gear', filter: (f) => f.endsWith('.json') },
	{ from: 'data/wildlife', to: 'wildlife', filter: (f) => f.endsWith('.json') }
];

fs.rmSync(outDir, { recursive: true, force: true });
const files = {};
for (const { from, to, filter } of sets) {
	const fromDir = path.join(root, from);
	const toDir = path.join(outDir, to);
	fs.mkdirSync(toDir, { recursive: true });
	// Solo ficheros de primer nivel: _manual/ y _crawled/ son entradas de la
	// ingesta, no parte del catálogo publicado.
	for (const file of fs.readdirSync(fromDir, { withFileTypes: true })) {
		if (!file.isFile() || !filter(file.name)) continue;
		const content = fs.readFileSync(path.join(fromDir, file.name));
		fs.writeFileSync(path.join(toDir, file.name), content);
		files[`${to}/${file.name}`] = crypto.createHash('sha256').update(content).digest('hex');
	}
}

const manifest = { version, published_at: new Date().toISOString(), files };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');

const routes = Object.keys(files).filter((f) => f.startsWith('routes/')).length;
const gpx = Object.keys(files).filter((f) => f.startsWith('gpx/')).length;
console.log(
	`Catálogo v${version} en ${path.relative(root, outDir)}: ${routes} rutas, ${gpx} GPX, ${Object.keys(files).length} ficheros.`
);
