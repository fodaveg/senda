/**
 * Perfil de elevación a partir de las posiciones del track:
 * distancia acumulada (km) frente a elevación (m). Puro y sin UI.
 */

import type { Position } from 'geojson';
import { haversineMeters } from './distance';

export interface ProfilePoint {
	/** Distancia acumulada desde el inicio, km. */
	km: number;
	/** Elevación, m. */
	ele: number;
	lon: number;
	lat: number;
}

/**
 * Marcas "redondas" para un eje (paso 1/2/5×10ⁿ) que cubran [min, max]
 * con ~targetCount intervalos. Para los ejes del perfil de elevación.
 */
export function axisTicks(min: number, max: number, targetCount = 4): number[] {
	const span = max - min;
	if (span <= 0 || !Number.isFinite(span)) return [min];
	const rawStep = span / targetCount;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const ratio = rawStep / magnitude;
	const step = magnitude * (ratio < 1.5 ? 1 : ratio < 3 ? 2 : ratio < 7 ? 5 : 10);
	const ticks: number[] = [];
	for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
		ticks.push(Number(v.toFixed(6)));
	}
	return ticks;
}

export type SlopeHardness = 'suave' | 'media' | 'dura';

/** Pendiente en % entre dos puntos del perfil (signo = sube/baja). */
export function slopePercent(a: ProfilePoint, b: ProfilePoint): number {
	const dMeters = (b.km - a.km) * 1000;
	if (dMeters <= 0) return 0;
	return ((b.ele - a.ele) / dMeters) * 100;
}

/** Dureza por pendiente absoluta: <8% suave, 8–15% media, >15% dura. */
export function slopeHardness(pct: number): SlopeHardness {
	const abs = Math.abs(pct);
	return abs < 8 ? 'suave' : abs < 15 ? 'media' : 'dura';
}

/** Pendiente local en el punto i (del anterior al siguiente), en %. */
export function slopeAtIndex(points: ProfilePoint[], i: number): number {
	if (points.length < 2) return 0;
	const a = points[Math.max(0, i - 1)];
	const b = points[Math.min(points.length - 1, i + 1)];
	return slopePercent(a, b);
}

export function elevationProfile(positions: Position[]): ProfilePoint[] {
	const points: ProfilePoint[] = [];
	let cumulativeM = 0;
	for (let i = 0; i < positions.length; i++) {
		const [lon, lat, ele] = positions[i];
		if (i > 0) {
			const [prevLon, prevLat] = positions[i - 1];
			cumulativeM += haversineMeters([prevLon, prevLat], [lon, lat]);
		}
		if (typeof ele === 'number') {
			points.push({ km: cumulativeM / 1000, ele, lon, lat });
		}
	}
	return points;
}
