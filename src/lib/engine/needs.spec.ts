import { describe, expect, it } from 'vitest';
import { energyEstimate, estimatedDurationMin, waterEstimate } from './needs';
import type { Route, WeatherDay } from '$lib/types';

function route(overrides: Partial<Route> = {}): Route {
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
		distance_km: 12,
		ascent_m: 600,
		descent_m: 600,
		circular: true,
		difficulty_mide: null,
		est_duration_min: 240,
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

function weather(temp: number): WeatherDay {
	return {
		date: '2026-07-01',
		temperature_2m_max: temp,
		temperature_2m_min: temp - 8,
		precipitation_probability_max: 0,
		precipitation_sum: 0,
		uv_index_max: 6,
		wind_speed_10m_max: 10,
		sunrise: '2026-07-01T06:30',
		sunset: '2026-07-01T21:25',
		source: 'open-meteo',
		fetched_at: '2026-07-01T05:00:00Z'
	};
}

describe('estimatedDurationMin', () => {
	it('usa el dato de la ficha si existe', () => {
		expect(estimatedDurationMin(route({ est_duration_min: 240 }))).toBe(240);
	});
	it('cae a Naismith si no hay dato (4 km/h + 600 m/h)', () => {
		// 12/4 h + 600/600 h = 4 h = 240 min
		expect(estimatedDurationMin(route({ est_duration_min: null }))).toBe(240);
	});
	it('null si faltan datos para estimar', () => {
		expect(estimatedDurationMin(route({ est_duration_min: null, ascent_m: null }))).toBeNull();
	});
});

describe('waterEstimate', () => {
	it('más agua con calor que con frío', () => {
		const hot = waterEstimate(route(), weather(32))!;
		const cool = waterEstimate(route(), weather(15))!;
		expect(hot.liters).toBeGreaterThan(cool.liters);
		expect(hot.reason).toMatch(/estimación/);
	});
	it('avisa de que no hay fuentes', () => {
		expect(waterEstimate(route({ water_points: [] }), weather(20))!.reason).toMatch(/sin fuentes/);
	});
	it('null si no se puede estimar la duración', () => {
		expect(waterEstimate(route({ est_duration_min: null, ascent_m: null }), null)).toBeNull();
	});
});

describe('energyEstimate', () => {
	it('crece con distancia, desnivel y peso', () => {
		const base = energyEstimate(route({ distance_km: 10, ascent_m: 300 }), 70).kcal;
		expect(energyEstimate(route({ distance_km: 20, ascent_m: 300 }), 70).kcal).toBeGreaterThan(
			base
		);
		expect(energyEstimate(route({ distance_km: 10, ascent_m: 1000 }), 70).kcal).toBeGreaterThan(
			base
		);
		expect(energyEstimate(route({ distance_km: 10, ascent_m: 300 }), 90).kcal).toBeGreaterThan(
			base
		);
	});
	it('usa peso por defecto si no es válido y lo etiqueta como estimación', () => {
		const e = energyEstimate(route(), 0);
		expect(e.kcal).toBeGreaterThan(0);
		expect(e.reason).toMatch(/estimación/);
	});
});
