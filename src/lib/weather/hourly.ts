/**
 * Pronóstico horario Open-Meteo (SPECS_V2 §5) para la ventana ideal de
 * inicio: temperatura, UV y probabilidad de precipitación por horas de un
 * día concreto. Puro, zod en el límite, fetch inyectable.
 */

import { z } from 'zod';

export interface HourlyPoint {
	/** Hora local ISO (YYYY-MM-DDTHH:MM). */
	time: string;
	temperature_2m: number;
	uv_index: number;
	precipitation_probability: number;
}

const responseSchema = z.object({
	hourly: z.object({
		time: z.array(z.string()),
		temperature_2m: z.array(z.number().nullable()),
		uv_index: z.array(z.number().nullable()),
		precipitation_probability: z.array(z.number().nullable())
	})
});

export function openMeteoHourlyUrl(lat: number, lon: number, date: string): string {
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(lat));
	url.searchParams.set('longitude', String(lon));
	url.searchParams.set('hourly', 'temperature_2m,uv_index,precipitation_probability');
	url.searchParams.set('start_date', date);
	url.searchParams.set('end_date', date);
	url.searchParams.set('timezone', 'Europe/Madrid');
	return url.toString();
}

/** Horas con algún valor null se descartan (nunca se inventa). */
export function normalizeHourly(payload: unknown): HourlyPoint[] {
	const result = responseSchema.safeParse(payload);
	if (!result.success) {
		throw new Error(`Respuesta horaria de Open-Meteo no válida:\n${z.prettifyError(result.error)}`);
	}
	const hourly = result.data.hourly;
	const points: HourlyPoint[] = [];
	for (let i = 0; i < hourly.time.length; i++) {
		const temperature = hourly.temperature_2m[i];
		const uv = hourly.uv_index[i];
		const prob = hourly.precipitation_probability[i];
		if (temperature === null || uv === null || prob === null) continue;
		points.push({
			time: hourly.time[i],
			temperature_2m: temperature,
			uv_index: uv,
			precipitation_probability: prob
		});
	}
	return points;
}

export async function fetchOpenMeteoHourly(
	lat: number,
	lon: number,
	date: string,
	fetchFn: typeof fetch = fetch
): Promise<HourlyPoint[]> {
	const response = await fetchFn(openMeteoHourlyUrl(lat, lon, date));
	if (!response.ok) throw new Error(`Open-Meteo (horario) respondió ${response.status}`);
	return normalizeHourly(await response.json());
}
