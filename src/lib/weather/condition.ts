import type { WeatherDay } from '$lib/types';

/** Resumen "de un vistazo" de un día: icono + etiqueta corta. */
export interface GlanceCondition {
	icon: string;
	label: string;
}

/**
 * Icono derivado de una probabilidad de lluvia (0–100). Compartido por la
 * condición diaria y la tira horaria: el pronóstico no trae nubosidad, así que
 * el icono solo refleja la probabilidad de precipitación, no un cielo observado.
 */
export function precipIcon(probability: number): string {
	if (probability >= 70) return '🌧️';
	if (probability >= 45) return '🌦️';
	if (probability >= 20) return '🌤️';
	return '☀️';
}

/**
 * Condición meteo "de un vistazo" derivada de un día de pronóstico.
 *
 * El pronóstico (Open-Meteo/AEMET en `WeatherDay`) **no** trae estado de cielo
 * observado (nubosidad), así que no se afirma "despejado/nuboso": el icono y la
 * etiqueta se **derivan** de `precipitation_probability_max` (0–100) —el único
 * dato disponible— y se redactan en términos de lluvia para no inventar
 * nubosidad. Decisión de producto (v6): la tarjeta "Meteo de un vistazo" se
 * apoya en la probabilidad de lluvia, no en un cielo simulado.
 */
export function glanceCondition(day: WeatherDay): GlanceCondition {
	const p = day.precipitation_probability_max;
	const icon = precipIcon(p);
	if (p >= 70) return { icon, label: 'Lluvia probable' };
	if (p >= 45) return { icon, label: 'Posible lluvia' };
	if (p >= 20) return { icon, label: 'Lluvia poco probable' };
	return { icon, label: 'Sin lluvia prevista' };
}
