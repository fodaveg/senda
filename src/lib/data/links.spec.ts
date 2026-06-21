import { describe, expect, it } from 'vitest';
import { linkedRoutes } from './links';
import type { Route } from '$lib/types';

function route(id: string, start: [number, number], end: [number, number] | null): Route {
	return {
		id,
		name: id,
		type: 'PR',
		status: 'homologado',
		status_detail: null,
		municipality: null,
		zone: null,
		aemet_municipio: null,
		start: { lat: start[1], lon: start[0], name: null },
		end: end ? { lat: end[1], lon: end[0] } : null,
		distance_km: 10,
		ascent_m: 100,
		descent_m: 100,
		circular: false,
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
		gpx: `${id}.gpx`,
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: null,
		sources: ['t']
	};
}

describe('linkedRoutes', () => {
	const base = route('base', [-0.5, 39.0], [-0.4, 39.1]); // fin en (-0.4, 39.1)
	const conecta = route('conecta', [-0.4, 39.1], [-0.3, 39.2]); // empieza en el fin de base
	const lejos = route('lejos', [-1.0, 40.0], [-1.1, 40.1]);

	it('enlaza rutas cuyos extremos casi coinciden', () => {
		const ids = linkedRoutes(base, [base, conecta, lejos]).map((r) => r.id);
		expect(ids).toContain('conecta');
		expect(ids).not.toContain('lejos');
		expect(ids).not.toContain('base');
	});

	it('sin extremos cercanos, no enlaza', () => {
		expect(linkedRoutes(lejos, [base, conecta])).toEqual([]);
	});
});
