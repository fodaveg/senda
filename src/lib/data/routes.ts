/**
 * Carga estática en build de data/routes/*.json (SPEC §1: sin backend).
 * El glob no desciende a _manual/, que es entrada de la ingesta, no salida.
 */

import type { Route } from '$lib/types';
import { isRouteVisible } from './federation';

const modules = import.meta.glob('../../../data/routes/*.json', {
	eager: true,
	import: 'default'
});

// Se filtran las federaciones deshabilitadas (HIDDEN_FEDERATIONS): sus JSON
// siguen en data/routes pero no entran al catálogo de la app ni al prerender.
export const routes: Route[] = (Object.values(modules) as Route[])
	.filter(isRouteVisible)
	.sort((a, b) => a.id.localeCompare(b.id));

export function routeById(id: string): Route | undefined {
	return routes.find((r) => r.id === id);
}
