import { describe, expect, it } from 'vitest';
import { normalizeText, searchRoutes } from './search';
import type { Route } from './types';

function route(overrides: Partial<Route>): Route {
	return {
		id: 'r',
		name: 'R',
		type: 'PR',
		status: 'homologado',
		status_detail: null,
		municipality: null,
		zone: null,
		aemet_municipio: null,
		start: { lat: 39, lon: -0.5, name: null },
		distance_km: 10,
		ascent_m: null,
		descent_m: null,
		circular: null,
		difficulty_mide: null,
		est_duration_min: null,
		water_points: [],
		water_points_geo: [],
		pois: [],
		escape_routes: [],
		highlights: [],
		best_season: [],
		best_start_time: null,
		shade_ratio: null,
		gpx: 'r.gpx',
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: null,
		sources: ['test'],
		...overrides
	};
}

const ROUTES = [
	route({ id: 'pr-cv-77', name: 'PR-CV 77 Chulilla - Sot de Chera', municipality: 'Chulilla' }),
	route({
		id: 'sl-cv-50',
		name: 'SL-CV 50 Cala del Moraig',
		municipality: 'El Poble Nou de Benitatxell',
		zone: 'marina-alta'
	}),
	route({ id: 'gr-7', name: 'GR 7', highlights: ['Cañón del Turia'] })
];

describe('searchRoutes', () => {
	it('consulta vacía devuelve todo', () => {
		expect(searchRoutes(ROUTES, '')).toHaveLength(3);
		expect(searchRoutes(ROUTES, '   ')).toHaveLength(3);
	});

	it('busca por nombre, municipio, comarca y highlights, sin acentos ni mayúsculas', () => {
		expect(searchRoutes(ROUTES, 'chulilla').map((r) => r.id)).toEqual(['pr-cv-77']);
		expect(searchRoutes(ROUTES, 'BENITATXELL').map((r) => r.id)).toEqual(['sl-cv-50']);
		expect(searchRoutes(ROUTES, 'marina alta').map((r) => r.id)).toEqual(['sl-cv-50']);
		expect(searchRoutes(ROUTES, 'cañon turia').map((r) => r.id)).toEqual(['gr-7']);
		expect(searchRoutes(ROUTES, 'canon').map((r) => r.id)).toEqual(['gr-7']);
	});

	it('varios términos = AND', () => {
		expect(searchRoutes(ROUTES, 'cv chulilla').map((r) => r.id)).toEqual(['pr-cv-77']);
		expect(searchRoutes(ROUTES, 'chulilla moraig')).toHaveLength(0);
	});
});

describe('normalizeText', () => {
	it('quita acentos y baja a minúsculas', () => {
		// La ñ también se descompone (n + virgulilla): 'canon' encuentra 'Cañón'.
		expect(normalizeText('Cañón del Túria')).toBe('canon del turia');
	});
});
