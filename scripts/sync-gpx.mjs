/**
 * Copia data/gpx → static/gpx antes de dev/build. Con el catálogo completo
 * (SPECS_V2 §4) los tracks se sirven como estáticos bajo demanda: ni se
 * empaquetan en JS ni se precachean en la PWA. data/gpx es el canónico;
 * static/gpx está en .gitignore.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'data/gpx');
const to = path.join(root, 'static/gpx');

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(to, { recursive: true });
let count = 0;
for (const file of fs.readdirSync(from)) {
	if (!file.endsWith('.gpx')) continue;
	fs.copyFileSync(path.join(from, file), path.join(to, file));
	count++;
}
console.log(`sync-gpx: ${count} tracks → static/gpx`);
