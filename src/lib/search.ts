/**
 * Buscador de rutas (SPECS_V2 §6): full-text en cliente sobre nombre,
 * municipio, comarca/zona y highlights, insensible a acentos y
 * mayúsculas. Con ~600 rutas un recorrido lineal en memoria sobra;
 * sin dependencias. Puro y testeable.
 */

import type { Route } from '$lib/types';

/** Campos m\u00ednimos que necesita la b\u00fasqueda (los cumple `Route` y `RouteSummary`). */
export type SearchableRoute = Pick<Route, 'id' | 'name' | 'municipality' | 'zone' | 'highlights'>;

export function normalizeText(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

function haystack(route: SearchableRoute): string {
	return normalizeText(
		[route.id, route.name, route.municipality, route.zone, ...route.highlights]
			.filter((part): part is string => Boolean(part))
			.join(' ')
	);
}

/**
 * Todos los términos de la consulta deben aparecer (AND). Consulta vacía
 * devuelve todas las rutas. Genérico: opera igual sobre rutas completas o sobre
 * el índice ligero (`RouteSummary`).
 */
export function searchRoutes<T extends SearchableRoute>(routes: T[], query: string): T[] {
	const terms = normalizeText(query).split(/\s+/).filter(Boolean);
	if (terms.length === 0) return routes;
	return routes.filter((route) => {
		const hay = haystack(route);
		return terms.every((term) => hay.includes(term));
	});
}
