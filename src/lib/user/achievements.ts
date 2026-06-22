/**
 * Logros y progreso por comarca a partir del diario (SPECS_V3.5 §4). Puro y
 * testeable: deriva de las salidas marcadas y de los datos verificados de las
 * rutas; no inventa nada (una ruta cuenta como "hecha" si tiene ≥1 salida).
 */

import type { Route } from '$lib/types';
import { liveOutings, type UserData } from './marks';

/** Ids de rutas con al menos una salida registrada (viva). */
function doneRouteIds(data: UserData): Set<string> {
	const done = new Set<string>();
	for (const [id, marks] of Object.entries(data.marks)) {
		if (liveOutings(marks).length > 0) done.add(id);
	}
	return done;
}

export interface ComarcaProgress {
	zone: string;
	total: number;
	done: number;
}

export interface ComarcaSummary {
	perComarca: ComarcaProgress[];
	/** Nº de comarcas del catálogo. */
	total: number;
	/** Comarcas con al menos una ruta hecha. */
	started: number;
	/** Comarcas con todas sus rutas hechas. */
	completed: number;
}

export function comarcaProgress(data: UserData, routes: Route[]): ComarcaSummary {
	const done = doneRouteIds(data);
	const byZone = new Map<string, { total: number; done: number }>();
	for (const r of routes) {
		if (!r.zone) continue;
		const entry = byZone.get(r.zone) ?? { total: 0, done: 0 };
		entry.total++;
		if (done.has(r.id)) entry.done++;
		byZone.set(r.zone, entry);
	}
	const perComarca = [...byZone.entries()]
		.map(([zone, e]) => ({ zone, total: e.total, done: e.done }))
		.sort((a, b) => b.done - a.done || a.zone.localeCompare(b.zone));
	return {
		perComarca,
		total: perComarca.length,
		started: perComarca.filter((c) => c.done > 0).length,
		completed: perComarca.filter((c) => c.total > 0 && c.done === c.total).length
	};
}

export interface Achievement {
	id: string;
	label: string;
	achieved: boolean;
}

/** Logros derivados del diario (umbrales fijos). */
export function achievements(data: UserData, routes: Route[]): Achievement[] {
	const byId = new Map(routes.map((r) => [r.id, r]));
	const done = doneRouteIds(data);
	let outings = 0;
	let km = 0;
	let ascent = 0;
	for (const [id, marks] of Object.entries(data.marks)) {
		const n = liveOutings(marks).length;
		outings += n;
		if (n > 0) {
			const r = byId.get(id);
			if (r) {
				km += r.distance_km;
				ascent += r.ascent_m ?? 0;
			}
		}
	}
	const grDone = [...done].filter((id) => byId.get(id)?.type === 'GR').length;
	const comarcasCompleted = comarcaProgress(data, routes).completed;

	return [
		{ id: 'salidas-10', label: '10 salidas', achieved: outings >= 10 },
		{ id: 'salidas-50', label: '50 salidas', achieved: outings >= 50 },
		{ id: 'km-100', label: '100 km acumulados', achieved: km >= 100 },
		{ id: 'km-500', label: '500 km acumulados', achieved: km >= 500 },
		{ id: 'ascent-10000', label: '10.000 m de desnivel', achieved: ascent >= 10000 },
		{ id: 'gr-1', label: 'Primera ruta GR', achieved: grDone >= 1 },
		{ id: 'gr-5', label: '5 rutas GR', achieved: grDone >= 5 },
		{ id: 'comarca-1', label: 'Una comarca completa', achieved: comarcasCompleted >= 1 },
		{ id: 'comarca-5', label: '5 comarcas completas', achieved: comarcasCompleted >= 5 }
	];
}
