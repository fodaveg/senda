/**
 * Enlaces inteligentes a Wikiloc (SPECS_V2 §10): solo un <a href> saliente
 * de búsqueda construido en runtime. Wikiloc NUNCA es fuente de datos
 * (sin API pública; el scraping viola sus términos).
 */

import type { Route } from '$lib/types';

export function wikilocSearchUrl(route: Route): string {
	const query = [route.name, route.municipality].filter(Boolean).join(' ');
	return `https://es.wikiloc.com/wikiloc/find.do?q=${encodeURIComponent(query)}`;
}
