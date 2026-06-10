/**
 * Cliente Open-Meteo (SPEC §4): pronóstico diario por coordenadas del punto
 * de inicio. Sin API key. Respuesta validada con zod en el límite (SPEC §10).
 * Puro y sin imports de Svelte; `fetchFn` inyectable para tests.
 */

import { z } from 'zod';
import type { WeatherDay } from '$lib/types';

/** Días de pronóstico: hoy + 7 (más allá la UI lo bloquea, SPEC §4). */
export const FORECAST_DAYS = 8;

const DAILY_VARS = [
	'temperature_2m_max',
	'temperature_2m_min',
	'precipitation_probability_max',
	'precipitation_sum',
	'uv_index_max',
	'wind_speed_10m_max',
	'sunrise',
	'sunset'
] as const;

const responseSchema = z.object({
	daily: z.object({
		time: z.array(z.string()),
		temperature_2m_max: z.array(z.number().nullable()),
		temperature_2m_min: z.array(z.number().nullable()),
		precipitation_probability_max: z.array(z.number().nullable()),
		precipitation_sum: z.array(z.number().nullable()),
		uv_index_max: z.array(z.number().nullable()),
		wind_speed_10m_max: z.array(z.number().nullable()),
		sunrise: z.array(z.string()),
		sunset: z.array(z.string())
	})
});

export function openMeteoUrl(lat: number, lon: number): string {
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(lat));
	url.searchParams.set('longitude', String(lon));
	url.searchParams.set('daily', DAILY_VARS.join(','));
	url.searchParams.set('forecast_days', String(FORECAST_DAYS));
	url.searchParams.set('timezone', 'Europe/Madrid');
	return url.toString();
}

/**
 * Normaliza la respuesta a WeatherDay[]. Un día con algún valor null se
 * descarta: mejor "sin pronóstico" (→ indeterminate en el motor) que un
 * dato inventado.
 */
export function normalizeOpenMeteo(payload: unknown, fetchedAt: string): WeatherDay[] {
	const result = responseSchema.safeParse(payload);
	if (!result.success) {
		throw new Error(`Respuesta de Open-Meteo no válida:\n${z.prettifyError(result.error)}`);
	}
	const daily = result.data.daily;
	const days: WeatherDay[] = [];
	for (let i = 0; i < daily.time.length; i++) {
		const candidate = {
			date: daily.time[i],
			temperature_2m_max: daily.temperature_2m_max[i],
			temperature_2m_min: daily.temperature_2m_min[i],
			precipitation_probability_max: daily.precipitation_probability_max[i],
			precipitation_sum: daily.precipitation_sum[i],
			uv_index_max: daily.uv_index_max[i],
			wind_speed_10m_max: daily.wind_speed_10m_max[i],
			sunrise: daily.sunrise[i],
			sunset: daily.sunset[i]
		};
		if (Object.values(candidate).some((v) => v === null || v === undefined)) continue;
		days.push({
			...(candidate as Omit<WeatherDay, 'source' | 'fetched_at'>),
			source: 'open-meteo',
			fetched_at: fetchedAt
		});
	}
	return days;
}

export async function fetchOpenMeteoForecast(
	lat: number,
	lon: number,
	fetchFn: typeof fetch = fetch
): Promise<WeatherDay[]> {
	const response = await fetchFn(openMeteoUrl(lat, lon));
	if (!response.ok) {
		throw new Error(`Open-Meteo respondió ${response.status}`);
	}
	return normalizeOpenMeteo(await response.json(), new Date().toISOString());
}
