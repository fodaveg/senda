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
