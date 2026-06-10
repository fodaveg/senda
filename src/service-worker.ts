/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Service worker PWA (SPEC §1 y M7): la app funciona 100% offline salvo el
 * módulo meteo. Precachea el shell (build + prerendered + static, incluidos
 * los GPX y JSON de rutas que Vite empaqueta en build) y sirve:
 * - assets precacheados: cache-first;
 * - navegaciones: network-first con caída a caché;
 * - peticiones cross-origin (Open-Meteo, AEMET, tiles): nunca se
 *   interceptan — su fallo lo gestiona la propia app con estados vacíos.
 */

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `senderos-cv-${version}`;
const PRECACHE = [...build, ...files, ...prerendered];

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
				const cached = (await cache.match(request)) ?? (await cache.match('/'));
				if (cached) return cached;
				throw error;
			}
		})
	);
});
