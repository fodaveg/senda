import { error } from '@sveltejs/kit';
import { routeById, routes } from '$lib/data/routes';
import type { EntryGenerator, PageLoad } from './$types';

/** Prerender de todas las rutas conocidas en build (adapter-static). */
export const entries: EntryGenerator = () => routes.map((r) => ({ id: r.id }));

export const load: PageLoad = ({ params }) => {
	const route = routeById(params.id);
	if (!route) error(404, 'Ruta no encontrada');
	return { route };
};
