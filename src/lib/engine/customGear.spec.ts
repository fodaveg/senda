import { describe, expect, it } from 'vitest';
import { evaluateCustomGear } from './evaluate';
import { ATTRIBUTE_WARNING_RULES } from './attributeRules';
import type { CustomGearItem, Route, WeatherDay } from '$lib/types';

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

function weather(overrides: Partial<WeatherDay> = {}): WeatherDay {
	return {
		date: '2026-07-01',
		temperature_2m_max: 20,
		temperature_2m_min: 12,
		precipitation_probability_max: 0,
		precipitation_sum: 0,
		uv_index_max: 5,
		wind_speed_10m_max: 10,
		sunrise: '2026-07-01T06:30',
		sunset: '2026-07-01T21:25',
		source: 'open-meteo',
		fetched_at: '2026-07-01T05:00:00Z',
		...overrides
	};
}

const SOCKS: CustomGearItem = {
	id: 'calcetines-impermeables',
	name: 'Calcetines impermeables',
	category: 'ropa',
	weight_g: 90,
	attributes: ['impermeable', 'abrigo']
};

describe('evaluateCustomGear', () => {
	it('desaconseja abrigo en ruta calurosa (ejemplo guía: pie cocido)', () => {
		const [d] = evaluateCustomGear(
			route(),
			weather({ temperature_2m_max: 31 }),
			'verano',
			[SOCKS],
			ATTRIBUTE_WARNING_RULES
		);
		expect(d.status).toBe('warn');
		expect(d.reason).toMatch(/31 °C/);
	});

	it('mantiene el ítem cuando hace fresco', () => {
		const [d] = evaluateCustomGear(
			route(),
			weather({ temperature_2m_max: 14, temperature_2m_min: 8 }),
			'primavera',
			[SOCKS],
			ATTRIBUTE_WARNING_RULES
		);
		expect(d.status).toBe('keep');
		expect(d.reason).toBeNull();
	});

	it('no desaconseja sin datos meteo (fail-safe, no avisa a ciegas)', () => {
		const [d] = evaluateCustomGear(route(), null, 'verano', [SOCKS], ATTRIBUTE_WARNING_RULES);
		expect(d.status).toBe('keep');
	});

	it('acumula varios motivos cuando saltan varias anti-reglas', () => {
		const item: CustomGearItem = { ...SOCKS, id: 'x', attributes: ['abrigo', 'aislante'] };
		const [d] = evaluateCustomGear(
			route(),
			weather({ temperature_2m_max: 30 }),
			'verano',
			[item],
			ATTRIBUTE_WARNING_RULES
		);
		expect(d.status).toBe('warn');
		expect(d.reason).toMatch(/abrigo/i);
		expect(d.reason).toMatch(/aislante/i);
	});

	it('un ítem sin atributos de riesgo nunca se desaconseja', () => {
		const item: CustomGearItem = {
			id: 'gorra',
			name: 'Gorra',
			category: 'ropa',
			weight_g: 40,
			attributes: ['sol']
		};
		const [d] = evaluateCustomGear(
			route(),
			weather({ temperature_2m_max: 35 }),
			'verano',
			[item],
			ATTRIBUTE_WARNING_RULES
		);
		expect(d.status).toBe('keep');
	});
});
