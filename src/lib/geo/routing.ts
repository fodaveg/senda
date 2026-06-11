/**
 * Tiempo de viaje en coche hasta el inicio de la ruta (SPECS_V2 §6):
 * OSRM público (router.project-osrm.org, sin key), siempre etiquetado
 * como estimación. Puro, zod en el límite, fetch/storage inyectables,
 * caché con TTL (el grafo viario no cambia a diario).
 */

import { z } from 'zod';
import type { KeyValueStorage } from '../weather/aemet';

export interface LatLon {
	lat: number;
	lon: number;
}

export interface DrivingEstimate {
	durationMin: number;
	distanceKm: number;
}

const responseSchema = z.object({
	code: z.string(),
	routes: z
		.array(
			z.object({
				duration: z.number(), // segundos
				distance: z.number() // metros
			})
		)
		.optional()
});

export function osrmUrl(from: LatLon, to: LatLon): string {
	const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
	return `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
}

export class RoutingError extends Error {}

export async function fetchDrivingEstimate(
	from: LatLon,
	to: LatLon,
	fetchFn: typeof fetch = fetch
): Promise<DrivingEstimate> {
	const response = await fetchFn(osrmUrl(from, to));
	if (!response.ok) throw new RoutingError(`OSRM respondió ${response.status}`);
	const parsed = responseSchema.safeParse(await response.json());
	if (!parsed.success) {
		throw new RoutingError(`Respuesta de OSRM no válida:\n${z.prettifyError(parsed.error)}`);
	}
	const route = parsed.data.routes?.[0];
	if (parsed.data.code !== 'Ok' || !route) {
		throw new RoutingError(`OSRM no encontró ruta (${parsed.data.code})`);
	}
	return {
		durationMin: Math.round(route.duration / 60),
		distanceKm: Math.round(route.distance / 100) / 10
	};
}

/** El grafo viario cambia poco: una semana de caché por par origen-destino. */
const ROUTING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(from: LatLon, to: LatLon): string {
	const r = (n: number) => n.toFixed(3);
	return `senderos-cv:osrm:${r(from.lat)},${r(from.lon)}→${r(to.lat)},${r(to.lon)}`;
}

export async function fetchDrivingEstimateCached(
	from: LatLon,
	to: LatLon,
	opts: { fetchFn?: typeof fetch; storage?: KeyValueStorage | null; now?: () => number } = {}
): Promise<DrivingEstimate> {
	const fetchFn = opts.fetchFn ?? fetch;
	const storage = opts.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
	const now = opts.now ?? Date.now;
	const key = cacheKey(from, to);

	if (storage) {
		try {
			const raw = storage.getItem(key);
			if (raw) {
				const cached = JSON.parse(raw) as { at: number; estimate: DrivingEstimate };
				if (typeof cached.at === 'number' && now() - cached.at < ROUTING_CACHE_TTL_MS) {
					return cached.estimate;
				}
			}
		} catch {
			// Caché corrupta: se ignora.
		}
	}
	const estimate = await fetchDrivingEstimate(from, to, fetchFn);
	if (storage) {
		try {
			storage.setItem(key, JSON.stringify({ at: now(), estimate }));
		} catch {
			// Solo optimización.
		}
	}
	return estimate;
}
