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

/** Entrada del índice de búsqueda: la ruta y su `haystack` ya normalizado. */
export interface SearchIndexEntry<T> {
	route: T;
	haystack: string;
}

/**
 * Precomputa el índice de búsqueda (SPECS_V4 §B6): normaliza el `haystack` de
 * cada ruta **una sola vez**. Así, con ~600 rutas, cada pulsación del buscador
 * no vuelve a normalizar todo el catálogo (la normalización NFD es lo caro);
 * solo compara cadenas ya preparadas.
 */
export function buildSearchIndex<T extends SearchableRoute>(routes: T[]): SearchIndexEntry<T>[] {
	return routes.map((route) => ({ route, haystack: haystack(route) }));
}

/** Filtra un índice ya construido por los términos de la consulta (AND). */
export function searchIndex<T>(index: SearchIndexEntry<T>[], query: string): T[] {
	const terms = normalizeText(query).split(/\s+/).filter(Boolean);
	if (terms.length === 0) return index.map((e) => e.route);
	return index
		.filter((entry) => terms.every((term) => entry.haystack.includes(term)))
		.map((entry) => entry.route);
}

/**
 * Todos los términos de la consulta deben aparecer (AND). Consulta vacía
 * devuelve todas las rutas. Genérico: opera igual sobre rutas completas o sobre
 * el índice ligero (`RouteSummary`). Conveniencia que construye el índice y
 * busca de una vez; para búsquedas repetidas (un buscador en vivo), reusa
 * `buildSearchIndex` + `searchIndex`.
 */
export function searchRoutes<T extends SearchableRoute>(routes: T[], query: string): T[] {
	return searchIndex(buildSearchIndex(routes), query);
}
