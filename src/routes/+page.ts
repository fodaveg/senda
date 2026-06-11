import { getRoutes } from '$lib/catalog';
import type { PageLoad } from './$types';

/** Las rutas salen del catálogo (almacén local → seed), no del seed directo. */
export const load: PageLoad = async () => {
	return { routes: await getRoutes() };
};
