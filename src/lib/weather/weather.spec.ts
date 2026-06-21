import { describe, expect, it } from 'vitest';
import { fetchOpenMeteoForecast, normalizeOpenMeteo, openMeteoUrl } from './openmeteo';
import { bestForecastDay, forecastDates, isoDate, seasonForDate } from './dates';
import type { WeatherDay } from '$lib/types';

function payloadOf(days: number, overrides: Partial<Record<string, unknown[]>> = {}) {
	const fill = (v: unknown) => Array.from({ length: days }, () => v);
	return {
		daily: {
			time: Array.from({ length: days }, (_, i) => `2026-06-${String(10 + i).padStart(2, '0')}`),
			temperature_2m_max: fill(28),
			temperature_2m_min: fill(17),
			precipitation_probability_max: fill(20),
			precipitation_sum: fill(0.4),
			uv_index_max: fill(8),
			wind_speed_10m_max: fill(22),
			sunrise: fill('2026-06-10T06:34'),
			sunset: fill('2026-06-10T21:26'),
			...overrides
		}
	};
}

describe('openMeteoUrl', () => {
	it('incluye coordenadas, variables diarias y 8 días', () => {
		const url = new URL(openMeteoUrl(39.654, -0.889));
		expect(url.hostname).toBe('api.open-meteo.com');
		expect(url.searchParams.get('latitude')).toBe('39.654');
		expect(url.searchParams.get('forecast_days')).toBe('8');
		expect(url.searchParams.get('daily')).toContain('uv_index_max');
	});
});

describe('normalizeOpenMeteo', () => {
	it('normaliza cada día a WeatherDay con fuente y timestamp', () => {
		const days = normalizeOpenMeteo(payloadOf(2), '2026-06-10T08:00:00Z');
		expect(days).toHaveLength(2);
		expect(days[0]).toMatchObject({
			date: '2026-06-10',
			temperature_2m_max: 28,
			uv_index_max: 8,
			source: 'open-meteo',
			fetched_at: '2026-06-10T08:00:00Z'
		});
	});

	it('descarta días con valores null en vez de inventar datos', () => {
		const days = normalizeOpenMeteo(
			payloadOf(3, { uv_index_max: [8, null, 7] }),
			'2026-06-10T08:00:00Z'
		);
		expect(days.map((d) => d.date)).toEqual(['2026-06-10', '2026-06-12']);
	});

	it('rechaza payloads con forma inesperada con error claro', () => {
		expect(() => normalizeOpenMeteo({ daily: { time: 'no-array' } }, 'x')).toThrow(/Open-Meteo/);
	});
});

describe('fetchOpenMeteoForecast', () => {
	it('valida y normaliza usando el fetch inyectado', async () => {
		const fakeFetch = (async () =>
			new Response(JSON.stringify(payloadOf(8)))) as unknown as typeof fetch;
		const days = await fetchOpenMeteoForecast(39.654, -0.889, fakeFetch);
		expect(days).toHaveLength(8);
		expect(days[0].source).toBe('open-meteo');
	});

	it('falla con el código HTTP si la API no responde 200', async () => {
		const fakeFetch = (async () =>
			new Response('boom', { status: 503 })) as unknown as typeof fetch;
		await expect(fetchOpenMeteoForecast(39.654, -0.889, fakeFetch)).rejects.toThrow(/503/);
	});
});

describe('fechas y estación', () => {
	it('forecastDates devuelve hoy + 7 en local', () => {
		const dates = forecastDates(new Date(2026, 5, 10));
		expect(dates).toHaveLength(8);
		expect(dates[0]).toBe('2026-06-10');
		expect(dates[7]).toBe('2026-06-17');
	});

	it('isoDate cruza fin de mes sin desfases UTC', () => {
		expect(isoDate(new Date(2026, 5, 30))).toBe('2026-06-30');
		expect(forecastDates(new Date(2026, 5, 30))[1]).toBe('2026-07-01');
	});

	it('seasonForDate respeta los límites de cada estación', () => {
		expect(seasonForDate('2026-01-15')).toBe('invierno');
		expect(seasonForDate('2026-02-28')).toBe('invierno');
		expect(seasonForDate('2026-03-01')).toBe('primavera');
		expect(seasonForDate('2026-06-10')).toBe('verano');
		expect(seasonForDate('2026-09-01')).toBe('otoño');
		expect(seasonForDate('2026-12-01')).toBe('invierno');
	});
});

describe('bestForecastDay', () => {
	const day = (date: string, rain: number, tmax: number, tmin = 14): WeatherDay => ({
		date,
		temperature_2m_max: tmax,
		temperature_2m_min: tmin,
		precipitation_probability_max: rain,
		precipitation_sum: 0,
		uv_index_max: 6,
		wind_speed_10m_max: 10,
		sunrise: `${date}T06:30`,
		sunset: `${date}T21:25`,
		source: 'open-meteo',
		fetched_at: `${date}T05:00:00Z`
	});

	it('elige el día con menos lluvia y temperatura más agradable', () => {
		const days = [
			day('2026-06-10', 80, 22), // muy lluvioso
			day('2026-06-11', 5, 20), // ideal
			day('2026-06-12', 10, 36) // calor extremo
		];
		expect(bestForecastDay(days)).toBe('2026-06-11');
	});

	it('null sin pronóstico', () => {
		expect(bestForecastDay([])).toBeNull();
	});
});
