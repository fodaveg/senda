import { error } from '@sveltejs/kit';
import { routeById, routes } from '$lib/data/routes';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => routes.map((r) => ({ id: r.id }));

export const load: PageLoad = ({ params }) => {
	const route = routeById(params.id);
	if (!route) error(404, 'Ruta no encontrada');
	return { route };
};
