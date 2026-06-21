/**
 * Rutas que enlazan (SPECS_V3.5 §5): otras rutas cuyo inicio o fin está muy
 * cerca del inicio o fin de esta, de modo que se pueden encadenar. Derivado de
 * coordenadas reales (start/end del track); no se inventa nada. Puro.
 */

import type { Route } from '$lib/types';
import { haversineMeters } from '$lib/geo/distance';

/** Distancia máxima entre extremos para considerarlas enlazables. */
const LINK_MAX_M = 500;
const MAX_RESULTS = 8;

export interface LinkedRoute {
	id: string;
	name: string;
}

function endpointsOf(route: Route): Array<[number, number]> {
	const pts: Array<[number, number]> = [[route.start.lon, route.start.lat]];
	if (route.end) pts.push([route.end.lon, route.end.lat]);
	return pts;
}

export function linkedRoutes(route: Route, all: Route[]): LinkedRoute[] {
	const mine = endpointsOf(route);
	const result: LinkedRoute[] = [];
	for (const other of all) {
		if (other.id === route.id) continue;
		const theirs = endpointsOf(other);
		const connects = mine.some((a) => theirs.some((b) => haversineMeters(a, b) <= LINK_MAX_M));
		if (connects) result.push({ id: other.id, name: other.name });
		if (result.length >= MAX_RESULTS) break;
	}
	return result;
}
