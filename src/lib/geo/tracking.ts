/**
 * Cálculos de "en ruta" (SPECS_V3.5 §6): desvío del track, distancia recorrida,
 * ritmo, distancia restante, previsión de luz y exportación a GPX de la salida
 * grabada. Todo **puro** (sin red ni Svelte): la captura GPS vive en la UI.
 * Son estimaciones; la UI las etiqueta como tales.
 */

import type { Position } from 'geojson';
import { haversineMeters } from './distance';

export interface RecordedPoint {
	lat: number;
	lon: number;
	/** epoch ms de la muestra. */
	t: number;
	/** elevación si el dispositivo la da. */
	ele?: number;
}

/** Índice del vértice del track más cercano a un punto [lon, lat]. */
export function nearestIndex(point: [number, number], track: Position[]): number {
	let best = Infinity;
	let bestIndex = 0;
	for (let i = 0; i < track.length; i++) {
		const d = haversineMeters(point, [track[i][0], track[i][1]]);
		if (d < best) {
			best = d;
			bestIndex = i;
		}
	}
	return bestIndex;
}

/** Distancia mínima (m) de un punto al track. Infinity si el track está vacío. */
export function offRouteMeters(point: [number, number], track: Position[]): number {
	let best = Infinity;
	for (const p of track) {
		const d = haversineMeters(point, [p[0], p[1]]);
		if (d < best) best = d;
	}
	return best;
}

/** Distancia recorrida (m) sumando los segmentos de la grabación. */
export function traveledMeters(points: RecordedPoint[]): number {
	let sum = 0;
	for (let i = 1; i < points.length; i++) {
		sum += haversineMeters([points[i - 1].lon, points[i - 1].lat], [points[i].lon, points[i].lat]);
	}
	return sum;
}

/** Ritmo en km/h dados metros y milisegundos. 0 si no hay tiempo. */
export function paceKmh(meters: number, elapsedMs: number): number {
	if (elapsedMs <= 0) return 0;
	return meters / 1000 / (elapsedMs / 3_600_000);
}

/** Metros restantes del track desde el vértice más cercano al punto hasta el fin. */
export function remainingMeters(point: [number, number], track: Position[]): number {
	if (track.length < 2) return 0;
	const i = nearestIndex(point, track);
	let sum = 0;
	for (let j = i + 1; j < track.length; j++) {
		sum += haversineMeters([track[j - 1][0], track[j - 1][1]], [track[j][0], track[j][1]]);
	}
	return sum;
}

export interface LightForecast {
	/** epoch ms de llegada estimada, o null si no se puede estimar (sin ritmo). */
	etaMs: number | null;
	/** true si llegas antes del anochecer; null si indeterminado. */
	beforeSunset: boolean | null;
}

/** Previsión de luz: ETA = ahora + restante/ritmo; compara con el ocaso. */
export function lightForecast(
	remainingM: number,
	pace: number,
	nowMs: number,
	sunsetMs: number
): LightForecast {
	if (pace <= 0) return { etaMs: null, beforeSunset: null };
	const etaMs = nowMs + (remainingM / 1000 / pace) * 3_600_000;
	return { etaMs, beforeSunset: etaMs <= sunsetMs };
}

/** GPX 1.1 de la salida grabada (puro). */
export function toGpx(points: RecordedPoint[], name: string): string {
	const esc = (s: string) =>
		s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
	const pts = points
		.map((p) => {
			const ele = typeof p.ele === 'number' ? `<ele>${p.ele}</ele>` : '';
			const time = `<time>${new Date(p.t).toISOString()}</time>`;
			return `<trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}</trkpt>`;
		})
		.join('\n');
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<gpx version="1.1" creator="Senderos CV" xmlns="http://www.topografix.com/GPX/1/1">\n' +
		`<trk><name>${esc(name)}</name><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>\n`
	);
}
