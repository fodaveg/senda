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
			points.push({ km: cumulativeM / 1000, ele });
		}
	}
	return points;
}
