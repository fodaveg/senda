import { getRouteSummaries } from '$lib/catalog';
import type { PageLoad } from './$types';

/**
 * El descubrimiento usa el índice ligero del catálogo (SPECS_V4 §B6): solo los
 * campos del listado/mapa, no la ficha completa (que se carga al abrir cada
 * ruta). Reduce el payload de hidratación de la home con ~600 rutas.
 */
export const load: PageLoad = async () => {
	return { routes: await getRouteSummaries() };
};
