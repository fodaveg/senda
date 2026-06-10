/**
 * AEMET OpenData (SPEC §4): segunda fuente opcional de verificación.
 * Pronóstico municipal diario en dos pasos (la API devuelve una URL de
 * datos). Requiere api key gratuita (ajustes). Validación zod en el límite.
 *
 * Si AEMET y Open-Meteo difieren significativamente, se muestran ambas
 * fuentes y se marca la discrepancia. Nunca se promedia en silencio.
 */

import { z } from 'zod';
import type { WeatherDay } from '$lib/types';

/** Subconjunto comparable del pronóstico municipal de AEMET. */
export interface AemetDay {
	date: string;
	temperature_2m_max: number;
	temperature_2m_min: number;
	precipitation_probability_max: number;
	uv_index_max: number | null;
	source: 'aemet';
	fetched_at: string;
}

const envelopeSchema = z.object({
	estado: z.number(),
	datos: z.url().optional(),
	descripcion: z.string().optional()
});

const dataSchema = z
	.array(
		z.object({
			prediccion: z.object({
				dia: z.array(
					z.looseObject({
						fecha: z.string(),
						probPrecipitacion: z.array(z.looseObject({ value: z.number().nullable().optional() })),
						temperatura: z.looseObject({
							maxima: z.number().nullable().optional(),
							minima: z.number().nullable().optional()
						}),
						uvMax: z.number().optional()
					})
				)
			})
		})
	)
	.min(1);

export function aemetUrl(municipio: string): string {
	return `https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/${municipio}`;
}

/** Normaliza el JSON de datos de AEMET; días incompletos se descartan. */
export function normalizeAemet(payload: unknown, fetchedAt: string): AemetDay[] {
	const result = dataSchema.safeParse(payload);
	if (!result.success) {
		throw new Error(`Respuesta de AEMET no válida:\n${z.prettifyError(result.error)}`);
	}
	const days: AemetDay[] = [];
	for (const dia of result.data[0].prediccion.dia) {
		const probs = dia.probPrecipitacion
			.map((p) => p.value)
			.filter((v): v is number => typeof v === 'number');
		const max = dia.temperatura.maxima;
		const min = dia.temperatura.minima;
		if (probs.length === 0 || typeof max !== 'number' || typeof min !== 'number') continue;
		days.push({
			date: dia.fecha.slice(0, 10),
			temperature_2m_max: max,
			temperature_2m_min: min,
			precipitation_probability_max: Math.max(...probs),
			uv_index_max: typeof dia.uvMax === 'number' ? dia.uvMax : null,
			source: 'aemet',
			fetched_at: fetchedAt
		});
	}
	return days;
}

export async function fetchAemetForecast(
	municipio: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<AemetDay[]> {
	const envelopeResponse = await fetchFn(`${aemetUrl(municipio)}?api_key=${apiKey}`);
	if (!envelopeResponse.ok) throw new Error(`AEMET respondió ${envelopeResponse.status}`);
	const envelope = envelopeSchema.safeParse(await envelopeResponse.json());
	if (!envelope.success || !envelope.data.datos) {
		throw new Error(
			`AEMET no devolvió URL de datos${envelope.success && envelope.data.descripcion ? `: ${envelope.data.descripcion}` : ''}`
		);
	}
	const dataResponse = await fetchFn(envelope.data.datos);
	if (!dataResponse.ok) throw new Error(`AEMET (datos) respondió ${dataResponse.status}`);
	return normalizeAemet(await dataResponse.json(), new Date().toISOString());
}

// ─── Comparación de fuentes ─────────────────────────────────────────────────

export interface WeatherDiscrepancy {
	label: string;
	openMeteo: string;
	aemet: string;
}

/** Umbral de discrepancia en prob. de lluvia (puntos porcentuales, SPEC §4). */
const RAIN_PROB_THRESHOLD = 30;
/** Umbral de discrepancia en temperatura máxima (°C). */
const TEMP_THRESHOLD = 5;

/** Discrepancias significativas entre fuentes; vacío = coherentes. */
export function compareForecasts(openMeteo: WeatherDay, aemet: AemetDay): WeatherDiscrepancy[] {
	const discrepancies: WeatherDiscrepancy[] = [];
	if (
		Math.abs(openMeteo.precipitation_probability_max - aemet.precipitation_probability_max) >=
		RAIN_PROB_THRESHOLD
	) {
		discrepancies.push({
			label: 'Probabilidad de lluvia',
			openMeteo: `${openMeteo.precipitation_probability_max}%`,
			aemet: `${aemet.precipitation_probability_max}%`
		});
	}
	if (Math.abs(openMeteo.temperature_2m_max - aemet.temperature_2m_max) >= TEMP_THRESHOLD) {
		discrepancies.push({
			label: 'Temperatura máxima',
			openMeteo: `${openMeteo.temperature_2m_max}°`,
			aemet: `${aemet.temperature_2m_max}°`
		});
	}
	return discrepancies;
}
