/**
 * Riesgo meteorológico de incendio forestal de AEMET (SPECS_V3, corrección
 * 2026-06-20). AEMET OpenData solo publica el riesgo como **mapa (imagen)
 * por zona peninsular**, no como nivel por coordenada/municipio: por eso esto
 * devuelve la URL del mapa oficial del día y la UI la muestra con la
 * explicación de niveles; el usuario localiza su zona. No se infiere ni se
 * inventa un nivel por ruta (regla v1: nada sin fuente).
 *
 * Niveles (sistema canadiense): bajo · moderado · alto · muy alto · extremo.
 *
 * Cliente puro con fetch inyectable; la imagen la carga el navegador (<img>),
 * así que aquí solo se resuelve el "sobre" {estado, datos} de AEMET.
 */

import { z } from 'zod';
import { AemetAuthError, AemetRateLimitError } from './aemet';

const BASE = 'https://opendata.aemet.es/opendata/api';

/** Península (cubre la Comunitat Valenciana). AEMET no da granularidad menor. */
export const FIRE_RISK_AREA_PENINSULA = 'p';

/** Días de predicción de riesgo que ofrece AEMET (0 = estimado de hoy). */
export const FIRE_RISK_MAX_DAY = 3;

const envelopeSchema = z.object({
	estado: z.number(),
	datos: z.url().optional(),
	descripcion: z.string().optional()
});

/** Endpoint del mapa de riesgo: estimado (hoy) o previsto (día 1..3). */
export function fireRiskUrl(dayOffset: number, area: string = FIRE_RISK_AREA_PENINSULA): string {
	return dayOffset <= 0
		? `${BASE}/incendios/mapasriesgo/estimado/area/${area}`
		: `${BASE}/incendios/mapasriesgo/previsto/dia/${dayOffset}/area/${area}`;
}

/**
 * URL de la imagen del mapa de riesgo para el día (offset desde hoy), o `null`
 * si el día está fuera del rango de predicción o AEMET no tiene mapa. El
 * `datos` de AEMET es una URL temporal a la imagen (no necesita api key).
 */
export async function fetchFireRiskMap(
	apiKey: string,
	dayOffset: number,
	area: string = FIRE_RISK_AREA_PENINSULA,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	if (dayOffset < 0 || dayOffset > FIRE_RISK_MAX_DAY) return null;
	const response = await fetchFn(`${fireRiskUrl(dayOffset, area)}?api_key=${apiKey}`);
	if (response.status === 401 || response.status === 403) {
		throw new AemetAuthError(`AEMET rechazó la api key (${response.status})`);
	}
	if (response.status === 429) {
		throw new AemetRateLimitError('AEMET respondió 429 (límite de peticiones)');
	}
	if (!response.ok) throw new Error(`AEMET incendios respondió ${response.status}`);
	const envelope = envelopeSchema.safeParse(await response.json());
	if (!envelope.success || !envelope.data.datos) {
		if (envelope.success && envelope.data.estado === 404) return null;
		throw new Error('AEMET incendios no devolvió URL de datos');
	}
	return envelope.data.datos;
}
