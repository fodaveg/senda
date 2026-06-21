import { describe, expect, it } from 'vitest';
import type { Position } from 'geojson';
import {
	lightForecast,
	offRouteMeters,
	paceKmh,
	remainingMeters,
	toGpx,
	traveledMeters,
	type RecordedPoint
} from './tracking';

// Track recto hacia el norte (~1112 m por 0,01° lat).
const TRACK: Position[] = Array.from({ length: 11 }, (_, i) => [-0.5, 39 + i * 0.001]);

describe('offRouteMeters', () => {
	it('0 sobre el track, crece al alejarse', () => {
		expect(offRouteMeters([-0.5, 39.005], TRACK)).toBeLessThan(60);
		expect(offRouteMeters([-0.51, 39.005], TRACK)).toBeGreaterThan(500);
	});
});

describe('traveledMeters / paceKmh', () => {
	it('suma segmentos y calcula ritmo', () => {
		const pts: RecordedPoint[] = [
			{ lat: 39.0, lon: -0.5, t: 0 },
			{ lat: 39.009, lon: -0.5, t: 3_600_000 } // ~1 km en 1 h
		];
		const m = traveledMeters(pts);
		expect(m).toBeGreaterThan(900);
		expect(paceKmh(m, 3_600_000)).toBeCloseTo(1, 0);
		expect(paceKmh(100, 0)).toBe(0);
	});
});

describe('remainingMeters', () => {
	it('decrece según avanzas por el track', () => {
		const start = remainingMeters([-0.5, 39.0], TRACK);
		const mid = remainingMeters([-0.5, 39.005], TRACK);
		expect(start).toBeGreaterThan(mid);
		expect(remainingMeters([-0.5, 39.01], TRACK)).toBeCloseTo(0, 0);
	});
});

describe('lightForecast', () => {
	it('antes/después del ocaso según ritmo', () => {
		const now = Date.parse('2026-07-01T18:00:00Z');
		const sunset = Date.parse('2026-07-01T21:00:00Z');
		// 3 km restantes a 4 km/h = 45 min → 18:45, antes del ocaso.
		expect(lightForecast(3000, 4, now, sunset).beforeSunset).toBe(true);
		// 3 km a 0,5 km/h = 6 h → pasa del ocaso.
		expect(lightForecast(3000, 0.5, now, sunset).beforeSunset).toBe(false);
		expect(lightForecast(3000, 0, now, sunset).beforeSunset).toBeNull();
	});
});

describe('toGpx', () => {
	it('genera GPX con los puntos grabados', () => {
		const gpx = toGpx([{ lat: 39, lon: -0.5, t: 0, ele: 100 }], 'Mi salida');
		expect(gpx).toContain('<gpx');
		expect(gpx).toContain('<trkpt lat="39" lon="-0.5">');
		expect(gpx).toContain('<ele>100</ele>');
		expect(gpx).toContain('<name>Mi salida</name>');
	});
});
