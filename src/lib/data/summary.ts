/**
 * Índice ligero del catálogo (SPECS_V4 §B6). El listado y el mapa de la home no
 * necesitan los campos pesados de cada ruta (`sources`, `pois`, geometría de
 * agua, enlaces, etc.): con ~600 rutas, serializar la ficha completa en la página
 * infla el payload de hidratación. `RouteSummary` deja solo lo que el
 * descubrimiento usa (búsqueda, filtros, marcadores, tarjeta de previsualización
 * y listado); la **ficha completa se carga bajo demanda** al abrir cada ruta
 * (`getRouteById`). El loader sigue teniendo fallback: si algo falla, la home
 * puede seguir con el catálogo completo.
 */

import type { Route } from '$lib/types';

/** Campos del catálogo que necesita la pantalla de descubrimiento. */
export type RouteSummary = Pick<
	Route,
	| 'id'
	| 'name'
	| 'type'
	| 'status'
	| 'status_detail'
	| 'municipality'
	| 'zone'
	| 'start'
	| 'distance_km'
	| 'ascent_m'
	| 'est_duration_min'
	| 'circular'
	| 'water_points'
	| 'water_points_geo'
	| 'shade_ratio'
	| 'highlights'
	| 'bbox'
	| 'federacion'
>;

/** Deriva el resumen ligero de una ruta completa (puro). */
export function toRouteSummary(route: Route): RouteSummary {
	return {
		id: route.id,
		name: route.name,
		type: route.type,
		status: route.status,
		status_detail: route.status_detail,
		municipality: route.municipality,
		zone: route.zone,
		start: route.start,
		distance_km: route.distance_km,
		ascent_m: route.ascent_m,
		est_duration_min: route.est_duration_min,
		circular: route.circular,
		water_points: route.water_points,
		water_points_geo: route.water_points_geo,
		shade_ratio: route.shade_ratio,
		highlights: route.highlights,
		bbox: route.bbox,
		// Fuente/federación para la atribución por fila (handoff v6). Cadena mínima;
		// el catálogo CV actual no la trae y se etiqueta como FEMECV al presentar.
		federacion: route.federacion
	};
}
