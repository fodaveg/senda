import { getRoutes } from '$lib/catalog';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return { routes: await getRoutes() };
};
