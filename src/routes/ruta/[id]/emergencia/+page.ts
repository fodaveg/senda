import { error } from '@sveltejs/kit';
import { getRouteById } from '$lib/catalog';
import { routes } from '$lib/data/routes';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => routes.map((r) => ({ id: r.id }));

export const load: PageLoad = async ({ params }) => {
	const route = await getRouteById(params.id);
	if (!route) error(404, 'Ruta no encontrada');
	return { route };
};
