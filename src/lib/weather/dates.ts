/**
 * Fechas del selector (hoy + 7 días) y estación del año. Puro, sin UI.
 */

import type { Season, WeatherDay } from '$lib/types';
import { FORECAST_DAYS } from './openmeteo';

/** Fecha local YYYY-MM-DD (sin sorpresas de UTC). */
export function isoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Las fechas seleccionables: hoy + 7. Más allá, pronóstico no fiable (SPEC §4). */
export function forecastDates(from: Date = new Date()): string[] {
	return Array.from({ length: FORECAST_DAYS }, (_, i) => {
		const d = new Date(from);
		d.setDate(d.getDate() + i);
		return isoDate(d);
	});
}

/** Estación meteorológica aproximada por mes (hemisferio norte). */
export function seasonForDate(date: string): Season {
	const month = Number(date.slice(5, 7));
	if (month === 12 || month <= 2) return 'invierno';
	if (month <= 5) return 'primavera';
	if (month <= 8) return 'verano';
	return 'otoño';
}

/**
 * "Mejor día" para una ruta dentro del pronóstico (SPECS_V3.5 §5): penaliza la
 * probabilidad de lluvia y el alejamiento de una temperatura agradable (~18 °C,
 * con extra por calor). Devuelve la fecha de menor penalización, o null si no
 * hay pronóstico. Puro; es una sugerencia, no una garantía.
 */
export function bestForecastDay(days: WeatherDay[]): string | null {
	if (days.length === 0) return null;
	const score = (d: WeatherDay): number => {
		const rain = d.precipitation_probability_max; // 0–100
		const heat = Math.max(0, d.temperature_2m_max - 24) * 4; // penaliza calor
		const cold = Math.max(0, 8 - d.temperature_2m_min) * 2; // penaliza frío
		return rain + heat + cold;
	};
	return days.reduce((best, d) => (score(d) < score(best) ? d : best)).date;
}

/** Etiqueta corta para el selector: "sáb 14 jun". */
export function dateLabel(date: string): string {
	return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}
