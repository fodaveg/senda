import { describe, expect, it } from 'vitest';
import { achievements, comarcaProgress } from './achievements';
import type { UserData } from './marks';
import type { Route } from '$lib/types';

function route(id: string, zone: string | null, type: Route['type'] = 'PR'): Route {
	return {
		id,
		name: id,
		type,
		status: 'homologado',
		status_detail: null,
		municipality: null,
		zone,
		aemet_municipio: null,
		start: { lat: 39, lon: -0.5, name: null },
		distance_km: 60,
		ascent_m: 2000,
		descent_m: 2000,
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
		gpx: `${id}.gpx`,
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: null,
		sources: ['t']
	};
}

const ROUTES = [
	route('a', 'serranos'),
	route('b', 'serranos'),
	route('c', 'safor'),
	route('gr-10', 'serranos', 'GR')
];

function withOutings(ids: string[]): UserData {
	const marks: UserData['marks'] = {};
	for (const id of ids) marks[id] = { outings: [{ date: '2026-05-01' }] };
	return { schema: 1, marks };
}

describe('comarcaProgress', () => {
	it('cuenta hechas/total por comarca y completadas', () => {
		const s = comarcaProgress(withOutings(['a', 'b', 'gr-10']), ROUTES);
		expect(s.total).toBe(2); // serranos, safor
		expect(s.started).toBe(1);
		expect(s.completed).toBe(1); // serranos: a,b,gr-10 todas hechas
		expect(s.perComarca.find((c) => c.zone === 'serranos')).toEqual({
			zone: 'serranos',
			total: 3,
			done: 3
		});
	});
});

describe('achievements', () => {
	it('marca logros según km, GR y comarcas', () => {
		const a = achievements(withOutings(['a', 'b', 'gr-10']), ROUTES);
		const by = (id: string) => a.find((x) => x.id === id)!.achieved;
		expect(by('km-100')).toBe(true); // 3×60 = 180 km
		expect(by('gr-1')).toBe(true);
		expect(by('comarca-1')).toBe(true);
		expect(by('salidas-50')).toBe(false);
	});

	it('sin salidas, ningún logro', () => {
		expect(achievements({ schema: 1, marks: {} }, ROUTES).every((a) => !a.achieved)).toBe(true);
	});
});
