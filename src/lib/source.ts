/**
 * Atribución de fuente de una ruta para el listado y la ficha (handoff v6).
 *
 * La traza y los metadatos oficiales los publica la federación; por defecto
 * FEMECV (el catálogo CV actual no trae `federacion`). Puro y testeable: lo
 * comparten la fila de ruta y la mini-ficha. No inventa fuentes: refleja la
 * federación declarada, sin atribuir OSM a la ruta en sí (los POIs/agua OSM se
 * atribuyen por punto en el mapa, no aquí).
 */
import type { Route } from '$lib/types';

/** Etiqueta corta "Federación · oficial" para la fila de ruta. */
export function routeSourceLabel(route: Pick<Route, 'federacion'>): string {
	return `${route.federacion ?? 'FEMECV'} · oficial`;
}
