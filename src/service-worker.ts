/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Service worker PWA (SPEC §1, SPECS_V2 §4): con el catálogo completo
 * (~850 rutas) precachearlo todo es inviable, así que se precachea el
 * shell (JS/CSS del build + estáticos pequeños + portada) y el resto se
 * cachea en runtime al visitarse:
 * - assets precacheados: cache-first;
 * - GPX y navegaciones: network-first con caída a caché (las rutas
 *   visitadas funcionan offline; los datos de ruta van en el bundle JS);
 * - navegación offline a página no cacheada: cae a '/' y el router de
 *   la SPA renderiza la página en cliente;
 * - peticiones cross-origin (Open-Meteo, AEMET, tiles): nunca se
 *   interceptan — su fallo lo gestiona la propia app con estados vacíos.
 */

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Ruta base del sitio sin barra final ('' en la raíz, '/sub' bajo subdirectorio).
// Se deriva de `import.meta.env.BASE_URL` (Vite la sustituye por el literal en
// build y dev) en vez de importar `base` de `$service-worker`: ese export falta
// en el módulo virtual de `$service-worker` en modo dev con Vite 8 y rompía el
// arranque del SW (y, en cascada, la hidratación en `npm run dev`).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

const CACHE = `senderos-cv-${version}`;
const PRECACHE = [...build, ...files.filter((f) => !f.startsWith(`${base}/gpx/`)), `${base}/`];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	// Assets precacheados: cache-first.
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const cached = await cache.match(url.pathname);
				return cached ?? fetch(request);
			})
		);
		return;
	}

	// Resto (navegaciones incluidas): network-first con caída a caché.
	event.respondWith(
		caches.open(CACHE).then(async (cache) => {
			try {
				const response = await fetch(request);
				if (response.ok) cache.put(request, response.clone());
				return response;
			} catch (error) {
				const cached = (await cache.match(request)) ?? (await cache.match(`${base}/`));
				if (cached) return cached;
				throw error;
			}
		})
	);
});
