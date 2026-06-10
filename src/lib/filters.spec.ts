import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS } from './filters';
import type { Route } from './types';

function route(overrides: Partial<Route>): Route {
	return {
		id: 'r',
		name: 'R',
		type: 'PR',
		status: 'homologado',
		zone: null,
		aemet_municipio: null,
		start: { lat: 39, lon: -0.5, name: null },
		distance_km: 10,
		ascent_m: 400,
		descent_m: 400,
		circular: true,
		difficulty_mide: null,
		est_duration_min: null,
		water_points: [],
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
	route({ id: 'gr-larga', type: 'GR', distance_km: 26, ascent_m: 600, circular: false }),
	route({ id: 'pr-media', type: 'PR', distance_km: 12, ascent_m: 900, circular: true }),
	route({ id: 'sl-corta', type: 'SL', distance_km: 3, ascent_m: 200, circular: false }),
	route({ id: 'sin-datos', type: 'PR', distance_km: 8, ascent_m: null, circular: null })
];

describe('applyFilters', () => {
	it('sin filtros devuelve todo', () => {
		expect(applyFilters(ROUTES, EMPTY_FILTERS)).toHaveLength(4);
	});

	it('filtra por tipo (varios a la vez)', () => {
		const result = applyFilters(ROUTES, { ...EMPTY_FILTERS, types: ['GR', 'SL'] });
		expect(result.map((r) => r.id)).toEqual(['gr-larga', 'sl-corta']);
	});

	it('filtra por distancia máxima', () => {
		const result = applyFilters(ROUTES, { ...EMPTY_FILTERS, maxDistanceKm: 10 });
		expect(result.map((r) => r.id)).toEqual(['sl-corta', 'sin-datos']);
	});

	it('filtra por desnivel máximo sin excluir rutas con desnivel desconocido', () => {
		const result = applyFilters(ROUTES, { ...EMPTY_FILTERS, maxAscentM: 600 });
		expect(result.map((r) => r.id)).toEqual(['gr-larga', 'sl-corta', 'sin-datos']);
	});

	it('filtra por circular sin excluir rutas con dato desconocido', () => {
		const result = applyFilters(ROUTES, { ...EMPTY_FILTERS, circular: true });
		expect(result.map((r) => r.id)).toEqual(['pr-media', 'sin-datos']);
	});

	it('combina filtros con AND', () => {
		const result = applyFilters(ROUTES, {
			...EMPTY_FILTERS,
			types: ['PR'],
			maxDistanceKm: 10
		});
		expect(result.map((r) => r.id)).toEqual(['sin-datos']);
	});
});
