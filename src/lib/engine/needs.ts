/**
 * Necesidades cuantificadas de la mochila (SPECS_V3.5 §1): estimación de agua
 * (litros) y energía (kcal) de una ruta. Funciones **puras**, sin imports de
 * Svelte. Son **estimaciones** con método explícito, no datos verificados: la
 * UI las etiqueta como tales y devuelven `null` cuando faltan datos.
 */

import type { Route, WeatherDay } from '$lib/types';
import { formatDuration } from '$lib/format';

/**
 * Duración estimada en minutos: el dato de la ficha si existe; si no, regla de
 * Naismith (≈4 km/h en llano + 600 m/h de subida). null si faltan distancia y
 * desnivel.
 */
export function estimatedDurationMin(route: Route): number | null {
	if (route.est_duration_min !== null) return route.est_duration_min;
	if (route.ascent_m === null) return null;
	const hours = route.distance_km / 4 + route.ascent_m / 600;
	return Math.round(hours * 60);
}

const round = (n: number, step: number) => Math.round(n / step) * step;

export interface WaterEstimate {
	liters: number;
	reason: string;
}

/**
 * Agua recomendada: ritmo base por hora de actividad, mayor con calor; nota
 * sobre fuentes en ruta. null si no se puede estimar la duración.
 */
export function waterEstimate(route: Route, weather: WeatherDay | null): WaterEstimate | null {
	const dur = estimatedDurationMin(route);
	if (dur === null) return null;
	const hours = dur / 60;
	const temp = weather?.temperature_2m_max ?? null;
	let rate = 0.5; // L/h genérico
	if (temp !== null) {
		if (temp >= 30) rate = 0.9;
		else if (temp >= 25) rate = 0.7;
		else if (temp >= 18) rate = 0.5;
		else rate = 0.4;
	}
	const liters = Math.max(0.5, round(hours * rate, 0.25));
	const calor = temp !== null && temp >= 25 ? ` con ${temp} °C` : '';
	const fuentes =
		route.water_points.length > 0
			? 'hay fuentes en ruta (verifícalas), ajusta en consecuencia'
			: 'sin fuentes fiables: llévala toda desde el inicio';
	return {
		liters,
		reason: `≈ ${liters} L para ${formatDuration(dur)} de actividad${calor}; ${fuentes} (estimación)`
	};
}

export interface EnergyEstimate {
	kcal: number;
	reason: string;
}

/** kcal por defecto si no hay peso del usuario. */
const DEFAULT_WEIGHT_KG = 70;

/**
 * Energía estimada: marcha en llano (≈0,5 kcal/kg/km) + coste de subida
 * (trabajo de elevar el peso con eficiencia ~25 %). Estimación, no medición.
 */
export function energyEstimate(route: Route, weightKg: number = DEFAULT_WEIGHT_KG): EnergyEstimate {
	const w = weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
	const ascent = route.ascent_m ?? 0;
	const flat = w * route.distance_km * 0.5;
	const climb = w * ascent * 0.00938;
	const kcal = round(flat + climb, 50);
	const peso = weightKg > 0 ? `${w} kg` : `${w} kg aprox.`;
	return {
		kcal,
		reason: `≈ ${kcal} kcal (${route.distance_km} km, +${ascent} m, ${peso}) — estimación`
	};
}
