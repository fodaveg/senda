import { describe, expect, it } from 'vitest';
import { diaryStats } from './stats';
import { USER_SCHEMA_VERSION, type UserData } from './marks';
import type { Route } from '$lib/types';

function route(id: string, partial: Partial<Route> = {}): Route {
	return {
		id,
		name: id.toUpperCase(),
		type: 'PR',
		status: 'homologado',
		status_detail: null,
		municipality: null,
		zone: null,
		aemet_municipio: null,
		start: { lat: 0, lon: 0, name: null },
		end: null,
		distance_km: 10,
		ascent_m: 300,
		descent_m: 300,
		circular: true,
		difficulty_mide: null,
		est_duration_min: 180,
		water_points: [],
		water_points_geo: [],
		pois: [],
		escape_routes: [],
		highlights: [],
		best_season: [],
		best_start_time: null,
		shade_ratio: null,
		gpx: `${id}.gpx`,
		links: { femecv: 'x', wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: null,
		sources: [],
		...partial
	} as Route;
}

function outing(id: string, date: string) {
	return { id, date, updated_at: '2026-01-01T00:00:00Z' };
}

describe('diaryStats — distinctDays', () => {
	it('cuenta días distintos en monte, no salidas', () => {
		const data: UserData = {
			schema: USER_SCHEMA_VERSION,
			marks: {
				a: { outings: [outing('o1', '2026-05-01'), outing('o2', '2026-05-01')] },
				b: { outings: [outing('o3', '2026-05-02')] }
			}
		};
		const stats = diaryStats(data, [route('a'), route('b')]);
		// 3 salidas en 2 días distintos.
		expect(stats.totalOutings).toBe(3);
		expect(stats.distinctDays).toBe(2);
	});

	it('es 0 sin salidas', () => {
		const stats = diaryStats({ schema: USER_SCHEMA_VERSION, marks: {} }, []);
		expect(stats.distinctDays).toBe(0);
	});
});
