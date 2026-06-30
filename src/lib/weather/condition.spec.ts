import { describe, expect, it } from 'vitest';
import { glanceCondition } from './condition';
import type { WeatherDay } from '$lib/types';

/** Día mínimo: glanceCondition solo lee precipitation_probability_max. */
function dayWithRain(probability: number): WeatherDay {
	return {
		date: '2026-06-10',
		temperature_2m_max: 24,
		temperature_2m_min: 12,
		precipitation_probability_max: probability,
		precipitation_sum: 0,
		uv_index_max: 7,
		wind_speed_10m_max: 15,
		sunrise: '2026-06-10T06:34',
		sunset: '2026-06-10T21:26',
		source: 'open-meteo',
		fetched_at: '2026-06-10T08:00:00Z'
	};
}

describe('glanceCondition', () => {
	it('sin lluvia prevista por debajo del 20%', () => {
		expect(glanceCondition(dayWithRain(0)).label).toBe('Sin lluvia prevista');
		expect(glanceCondition(dayWithRain(19)).label).toBe('Sin lluvia prevista');
	});

	it('lluvia poco probable entre 20% y 44%', () => {
		expect(glanceCondition(dayWithRain(20)).label).toBe('Lluvia poco probable');
		expect(glanceCondition(dayWithRain(44)).label).toBe('Lluvia poco probable');
	});

	it('posible lluvia entre 45% y 69%', () => {
		expect(glanceCondition(dayWithRain(45)).label).toBe('Posible lluvia');
		expect(glanceCondition(dayWithRain(69)).label).toBe('Posible lluvia');
	});

	it('lluvia probable a partir del 70%', () => {
		expect(glanceCondition(dayWithRain(70)).label).toBe('Lluvia probable');
		expect(glanceCondition(dayWithRain(100)).label).toBe('Lluvia probable');
	});

	it('cada tramo trae su icono', () => {
		expect(glanceCondition(dayWithRain(0)).icon).toBe('☀️');
		expect(glanceCondition(dayWithRain(30)).icon).toBe('🌤️');
		expect(glanceCondition(dayWithRain(50)).icon).toBe('🌦️');
		expect(glanceCondition(dayWithRain(80)).icon).toBe('🌧️');
	});
});
