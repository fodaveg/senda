import { describe, expect, it } from 'vitest';
import { toRouteSummary } from './summary';
import type { Route } from '$lib/types';

function route(): Route {
	return {
		id: 'pr-1',
		name: 'PR 1',
		type: 'PR',
		status: 'homologado',
		status_detail: null,
		municipality: 'Alcoi',
		zone: 'comtat',
		aemet_municipio: null,
		start: { lat: 38.7, lon: -0.47, name: null },
		end: null,
		distance_km: 12,
		ascent_m: 500,
		descent_m: 500,
		circular: true,
		difficulty_mide: null,
		est_duration_min: 240,
		water_points: [{ name: 'Font Roja', km: 3 }],
		water_points_geo: [{ name: 'Font Roja', lat: 38.7, lon: -0.47, km: 3, kind: 'fuente' }],
		pois: [{ name: 'Mirador', type: 'mirador', lat: 38.7, lon: -0.47, km: 2 }],
		escape_routes: [],
		highlights: ['cumbre'],
		best_season: [],
		best_start_time: null,
		shade_ratio: 0.6,
		gpx: 'pr-1.gpx',
		links: { femecv: 'x', wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: [-0.5, 38.6, -0.4, 38.8],
		sources: ['femecv']
	} as Route;
}

describe('toRouteSummary', () => {
	it('conserva los campos del descubrimiento', () => {
		const s = toRouteSummary(route());
		expect(s).toMatchObject({
			id: 'pr-1',
			name: 'PR 1',
			type: 'PR',
			municipality: 'Alcoi',
			zone: 'comtat',
			distance_km: 12,
			ascent_m: 500,
			circular: true,
			shade_ratio: 0.6,
			highlights: ['cumbre']
		});
		expect(s.start.lat).toBe(38.7);
		expect(s.bbox).toEqual([-0.5, 38.6, -0.4, 38.8]);
		// Necesarios para el filtro "con agua" y la tarjeta de previsualización.
		expect(s.water_points).toHaveLength(1);
		expect(s.water_points_geo).toHaveLength(1);
	});

	it('no arrastra los campos pesados de la ficha completa', () => {
		const s = toRouteSummary(route()) as Record<string, unknown>;
		for (const heavy of [
			'sources',
			'pois',
			'links',
			'gpx',
			'end',
			'difficulty_mide',
			'alternatives'
		]) {
			expect(heavy in s).toBe(false);
		}
	});
});
