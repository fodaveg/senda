import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS } from './filters';
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
		ascent_m: 400,
		descent_m: 400,
		circular: true,
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

describe('filtro por provincia (SPECS_V3 §7)', () => {
	const WITH_ZONES = [
		route({ id: 'val', zone: 'serranos' }), // Valencia
		route({ id: 'ali', zone: 'marina-alta' }), // Alicante
		route({ id: 'cas', zone: 'ports' }), // Castellón
		route({ id: 'sin-zona', zone: null })
	];

	it('filtra por provincia derivada de la comarca (excluye otras provincias)', () => {
		const ids = applyFilters(WITH_ZONES, { ...EMPTY_FILTERS, province: 'alicante' }).map(
			(r) => r.id
		);
		expect(ids).toContain('ali');
		expect(ids).not.toContain('val');
		expect(ids).not.toContain('cas');
	});

	it('no excluye rutas con comarca desconocida (fail-safe, como el resto de filtros)', () => {
		const ids = applyFilters(WITH_ZONES, { ...EMPTY_FILTERS, province: 'valencia' }).map(
			(r) => r.id
		);
		expect(ids).toContain('val');
		expect(ids).toContain('sin-zona');
		expect(ids).not.toContain('ali');
	});
});

describe('filtros "apto para" (SPECS_V3.5 §5)', () => {
	const ROUTES_APTO = [
		route({ id: 'con-agua', water_points: ['Fuente'] }),
		route({ id: 'con-sombra', shade_ratio: 0.6 }),
		route({ id: 'pelada', shade_ratio: 0.1 }),
		route({ id: 'sin-dato' })
	];

	it('"con agua" exige fuentes conocidas', () => {
		expect(
			applyFilters(ROUTES_APTO, { ...EMPTY_FILTERS, withWater: true }).map((r) => r.id)
		).toEqual(['con-agua']);
	});

	it('"alta sombra" exige shade_ratio conocido y alto', () => {
		expect(
			applyFilters(ROUTES_APTO, { ...EMPTY_FILTERS, highShade: true }).map((r) => r.id)
		).toEqual(['con-sombra']);
	});
});

describe('filtro de estado (SPECS_V2 §6)', () => {
	const WITH_STATUS = [
		...ROUTES,
		route({ id: 'baja', status: 'deshabilitado', status_detail: 'Baja / Deshomologado' }),
		route({ id: 'dudosa', status: 'con_reservas', status_detail: 'Sin controles de calidad' })
	];

	it('por defecto excluye las deshabilitadas y nada más', () => {
		const ids = applyFilters(WITH_STATUS, EMPTY_FILTERS).map((r) => r.id);
		expect(ids).not.toContain('baja');
		expect(ids).toHaveLength(5);
	});

	it('un estado concreto filtra solo ese estado', () => {
		const ids = applyFilters(WITH_STATUS, { ...EMPTY_FILTERS, status: 'con_reservas' }).map(
			(r) => r.id
		);
		expect(ids).toEqual(['dudosa']);
	});

	it("'todas' incluye también las deshabilitadas", () => {
		expect(applyFilters(WITH_STATUS, { ...EMPTY_FILTERS, status: 'todas' })).toHaveLength(6);
	});
});
