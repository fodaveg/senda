/**
 * Filtros del listado de rutas (SPEC §8.1: tipo, distancia, desnivel,
 * zona, circular). Puro y testeable.
 */

import type { Route, RouteStatus, RouteType } from '$lib/types';
import { provinceOf, type Province } from '$lib/geo/province';

export interface RouteFilters {
	/** Tipos incluidos; vacío = todos. */
	types: RouteType[];
	maxDistanceKm: number | null;
	maxAscentM: number | null;
	zone: string | null;
	/** Provincia derivada de la comarca (SPECS_V3 §7); null = todas. */
	province: Province | null;
	/** null = indiferente. */
	circular: boolean | null;
	/**
	 * SPECS_V2 §6: null = por defecto (todas salvo deshabilitadas);
	 * 'todas' = incluye también las deshabilitadas; un estado = solo ese.
	 */
	status: RouteStatus | 'todas' | null;
}

export const EMPTY_FILTERS: RouteFilters = {
	types: [],
	maxDistanceKm: null,
	maxAscentM: null,
	zone: null,
	province: null,
	circular: null,
	status: null
};

/**
 * Un campo null en la ruta nunca la excluye por un filtro de ese campo:
 * dato desconocido ≠ dato que incumple (coherente con el fail-safe del motor).
 */
export function applyFilters(routes: Route[], filters: RouteFilters): Route[] {
	return routes.filter((route) => {
		if (filters.types.length > 0 && !filters.types.includes(route.type)) return false;
		if (filters.maxDistanceKm !== null && route.distance_km > filters.maxDistanceKm) return false;
		if (
			filters.maxAscentM !== null &&
			route.ascent_m !== null &&
			route.ascent_m > filters.maxAscentM
		)
			return false;
		if (filters.zone !== null && route.zone !== null && route.zone !== filters.zone) return false;
		// Provincia derivada de la comarca; comarca desconocida no excluye.
		if (filters.province !== null) {
			const prov = provinceOf(route.zone);
			if (prov !== null && prov !== filters.province) return false;
		}
		if (filters.circular !== null && route.circular !== null && route.circular !== filters.circular)
			return false;
		// El estado nunca es null en la ruta; las deshabilitadas por FEMECV se
		// excluyen por defecto y solo aparecen pidiéndolo explícitamente.
		if (filters.status === null) {
			if (route.status === 'deshabilitado') return false;
		} else if (filters.status !== 'todas' && route.status !== filters.status) {
			return false;
		}
		return true;
	});
}
