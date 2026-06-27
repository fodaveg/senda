/**
 * Etiquetas legibles de los tipos de sendero FEMECV (GR/PR/SL). Puro y sin
 * Svelte: lo usan el badge de tipo (aria-label accesible) y cualquier informe.
 */

import type { RouteType } from '$lib/types';

/** Nombre completo de cada tipo, para lectores de pantalla y tooltips. */
export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
	GR: 'Gran Recorrido',
	PR: 'Pequeño Recorrido',
	SL: 'Sendero Local'
};

/** Nombre completo del tipo, o el propio código si no se reconoce. */
export function routeTypeLabel(type: string): string {
	return (ROUTE_TYPE_LABELS as Record<string, string>)[type] ?? type;
}
