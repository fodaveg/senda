/**
 * Ventana ideal de inicio (SPECS_V2 §5). Función pura, sin Svelte.
 *
 * Restricción dura: inicio + duración estimada + margen ≤ atardecer.
 * Optimización: si la ruta tiene poca sombra, evitar que el recorrido
 * coincida con la franja de calor/UV alto del pronóstico horario.
 *
 * Honestidad v1: sin duración estimada o sin pronóstico del día → null
 * (nunca una recomendación inventada). El pronóstico horario solo afina;
 * su ausencia no bloquea la ventana por luz.
 */

import type { Route, WeatherDay } from '$lib/types';
import type { HourlyPoint } from '$lib/weather/hourly';

/** Margen de luz tras el fin estimado (imprevistos), en minutos. */
const LIGHT_MARGIN_MIN = 30;
/** UV horario a partir del cual una hora cuenta como "de castigo". */
const UV_HOT_THRESHOLD = 7;
/** Temperatura horaria a partir de la cual una hora cuenta como calurosa. */
const TEMP_HOT_THRESHOLD = 28;
/** Sombra por debajo de la cual se intenta esquivar la franja de calor. */
const SHADE_THRESHOLD = 0.4;

export interface StartWindow {
	/** Franja recomendada de inicio, minutos desde medianoche (local). */
	startMin: number;
	endMin: number;
	/** Última hora de inicio que conserva margen de luz. */
	lightLimitMin: number;
	/** true si ni saliendo al amanecer se acaba antes del anochecer. */
	lightAlert: boolean;
	/** Franja de calor detectada [inicio, fin] en minutos, si la hay. */
	hotSpan: [number, number] | null;
	reasons: string[];
}

/** "…THH:MM[:SS]" → minutos desde medianoche; null si no parsea. */
export function isoTimeToMinutes(isoLocal: string): number | null {
	const match = isoLocal.match(/T(\d{2}):(\d{2})/);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToHhMm(minutes: number): string {
	const clamped = Math.max(0, Math.round(minutes));
	const h = Math.floor(clamped / 60) % 24;
	const m = clamped % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Franja contigua de horas de castigo (UV alto o calor), en minutos. */
function hotSpanOf(hourly: HourlyPoint[]): [number, number] | null {
	const hotMinutes = hourly
		.filter((h) => h.uv_index >= UV_HOT_THRESHOLD || h.temperature_2m >= TEMP_HOT_THRESHOLD)
		.map((h) => isoTimeToMinutes(h.time))
		.filter((m): m is number => m !== null);
	if (hotMinutes.length === 0) return null;
	// Cada punto horario representa su hora completa [h, h+60).
	return [Math.min(...hotMinutes), Math.max(...hotMinutes) + 60];
}

export function startWindow(
	route: Route,
	day: WeatherDay | null,
	hourly: HourlyPoint[] | null
): StartWindow | null {
	if (!day || route.est_duration_min === null) return null;
	const sunrise = isoTimeToMinutes(day.sunrise);
	const sunset = isoTimeToMinutes(day.sunset);
	if (sunrise === null || sunset === null) return null;

	const duration = route.est_duration_min;
	const lightLimit = sunset - duration - LIGHT_MARGIN_MIN;
	const reasons: string[] = [];

	if (lightLimit < sunrise) {
		return {
			startMin: sunrise,
			endMin: sunrise,
			lightLimitMin: lightLimit,
			lightAlert: true,
			hotSpan: null,
			reasons: [
				`La duración estimada (${Math.round(duration / 60)} h ${duration % 60} min, MIDE) no cabe en las horas de luz del día: ` +
					`amanece a las ${minutesToHhMm(sunrise)} y anochece a las ${minutesToHhMm(sunset)}. ` +
					'Plantea acortar la ruta o dividirla.'
			]
		};
	}

	const start = sunrise;
	let end = lightLimit;
	reasons.push(
		`Saliendo como muy tarde a las ${minutesToHhMm(lightLimit)} terminas antes del anochecer ` +
			`(${minutesToHhMm(sunset)}) con ${LIGHT_MARGIN_MIN} min de margen.`
	);

	// Esquivar la franja de calor solo si la ruta tiene poca sombra
	// verificada y hay pronóstico horario.
	const hotSpan =
		route.shade_ratio !== null && route.shade_ratio < SHADE_THRESHOLD && hourly
			? hotSpanOf(hourly)
			: null;
	if (hotSpan) {
		const finishBeforeHeat = hotSpan[0] - duration;
		if (finishBeforeHeat >= sunrise) {
			end = Math.min(end, finishBeforeHeat);
			reasons.push(
				`Con poca sombra (${Math.round((route.shade_ratio ?? 0) * 100)}%), saliendo antes de las ` +
					`${minutesToHhMm(end)} terminas antes de la franja de calor/UV alto ` +
					`(${minutesToHhMm(hotSpan[0])}–${minutesToHhMm(hotSpan[1])}).`
			);
		} else {
			reasons.push(
				`La franja de calor/UV alto (${minutesToHhMm(hotSpan[0])}–${minutesToHhMm(hotSpan[1])}) no se puede ` +
					'evitar del todo con esta duración: sal lo antes posible, con agua de sobra.'
			);
		}
	}

	if (end < start) end = start;
	return {
		startMin: start,
		endMin: end,
		lightLimitMin: lightLimit,
		lightAlert: false,
		hotSpan,
		reasons
	};
}

/** Franja posicionada sobre el eje (porcentajes 0–100). */
export interface TimelineBand {
	leftPct: number;
	widthPct: number;
}

/** Geometría del widget de ventana de inicio: eje + franjas + marcas horarias. */
export interface StartWindowTimeline {
	/** Eje en minutos: horas de luz redondeadas a la hora. */
	axisStartMin: number;
	axisEndMin: number;
	/** Franja recomendada (verde). */
	ideal: TimelineBand;
	/** Franja a evitar por calor/UV (ámbar), si la hay. */
	avoid: TimelineBand | null;
	/** Marcas horarias a etiquetar (hora 0–23 + posición). */
	ticks: { hour: number; leftPct: number }[];
}

/**
 * Traduce una `StartWindow` + el amanecer/anochecer del día a la geometría del
 * widget visual (eje de horas de luz, franjas ideal/calor en %, marcas
 * horarias). Pura y determinista; null si el día no aporta luz utilizable o la
 * ventana es de alerta (no hay franja que dibujar). Los anchos son crudos: el
 * mínimo visible se aplica en la presentación.
 */
export function startWindowTimeline(win: StartWindow, day: WeatherDay): StartWindowTimeline | null {
	if (win.lightAlert) return null;
	const sunrise = isoTimeToMinutes(day.sunrise);
	const sunset = isoTimeToMinutes(day.sunset);
	if (sunrise === null || sunset === null || sunset <= sunrise) return null;

	const axisStartMin = Math.floor(sunrise / 60) * 60;
	const axisEndMin = Math.ceil(sunset / 60) * 60;
	const span = axisEndMin - axisStartMin;
	const pct = (min: number) => Math.min(100, Math.max(0, ((min - axisStartMin) / span) * 100));

	const idealLeft = pct(win.startMin);
	const ideal: TimelineBand = { leftPct: idealLeft, widthPct: pct(win.endMin) - idealLeft };
	const avoid: TimelineBand | null = win.hotSpan
		? { leftPct: pct(win.hotSpan[0]), widthPct: pct(win.hotSpan[1]) - pct(win.hotSpan[0]) }
		: null;

	const startHour = axisStartMin / 60;
	const endHour = axisEndMin / 60;
	const step = Math.max(1, Math.round((endHour - startHour) / 4));
	const ticks: { hour: number; leftPct: number }[] = [];
	for (let h = startHour; h <= endHour; h += step)
		ticks.push({ hour: h % 24, leftPct: pct(h * 60) });

	return { axisStartMin, axisEndMin, ideal, avoid, ticks };
}
