import { describe, expect, it } from 'vitest';
import {
	nearestAlternatives,
	parseOverpass,
	pointInRing,
	shadeRatioOfTrack,
	waterPointsAlongTrack
} from './osm';
import type { Position } from 'geojson';

// Track recto de ~1,1 km hacia el norte (0,01° lat ≈ 1112 m).
const TRACK: Position[] = Array.from({ length: 11 }, (_, i) => [-0.5, 39 + i * 0.001]);

describe('parseOverpass', () => {
	it('separa nodos de agua y polígonos de bosque cerrados', () => {
		const { water, woods } = parseOverpass({
			elements: [
				{ type: 'node', lat: 39.0, lon: -0.5, tags: { amenity: 'drinking_water', name: 'Font' } },
				{ type: 'node', lat: 39.1, lon: -0.5, tags: { natural: 'spring' } },
				{
					type: 'way',
					geometry: [
						{ lat: 39, lon: -0.51 },
						{ lat: 39.01, lon: -0.51 },
						{ lat: 39.01, lon: -0.49 },
						{ lat: 39, lon: -0.51 }
					]
				},
				// Línea abierta: no es polígono.
				{
					type: 'way',
					geometry: [
						{ lat: 39, lon: -0.5 },
						{ lat: 39.1, lon: -0.5 },
						{ lat: 39.2, lon: -0.5 },
						{ lat: 39.3, lon: -0.5 }
					]
				}
			]
		});
		expect(water).toHaveLength(2);
		expect(water[0]).toMatchObject({ name: 'Font', kind: 'fuente' });
		expect(water[1].kind).toBe('manantial');
		expect(woods).toHaveLength(1);
	});

	it('payload sin elements → error', () => {
		expect(() => parseOverpass({})).toThrow(/Overpass/);
	});
});

describe('waterPointsAlongTrack', () => {
	it('incluye solo fuentes a ≤100 m, ordenadas por km y citando OSM', () => {
		const water = [
			{ lat: 39.005, lon: -0.5, name: 'Font del Mig', kind: 'fuente' as const },
			{ lat: 39.0, lon: -0.49, name: null, kind: 'manantial' as const } // ~860 m: fuera
		];
		const points = waterPointsAlongTrack(water, TRACK);
		expect(points).toHaveLength(1);
		expect(points[0]).toContain('Font del Mig');
		expect(points[0]).toContain('km 0.6');
		expect(points[0]).toContain('no verificado en campo');
	});
});

describe('shadeRatioOfTrack', () => {
	const bigWood = {
		// Cubre todo el track.
		ring: [
			[-0.51, 38.99],
			[-0.49, 38.99],
			[-0.49, 39.02],
			[-0.51, 39.02],
			[-0.51, 38.99]
		] as Array<[number, number]>
	};

	it('track entero bajo bosque → 1; sin bosques → null (no un 0 afirmado)', () => {
		expect(shadeRatioOfTrack([bigWood], TRACK)).toBe(1);
		expect(shadeRatioOfTrack([], TRACK)).toBeNull();
	});

	it('pointInRing distingue dentro y fuera', () => {
		expect(pointInRing([-0.5, 39.0], bigWood.ring)).toBe(true);
		expect(pointInRing([-0.6, 39.0], bigWood.ring)).toBe(false);
	});
});

describe('nearestAlternatives', () => {
	it('devuelve las 3 más cercanas dentro de 15 km, sin la propia ruta', () => {
		const all = [
			{ id: 'yo', start: { lat: 39, lon: -0.5 } },
			{ id: 'a-2km', start: { lat: 39.018, lon: -0.5 } },
			{ id: 'b-5km', start: { lat: 39.045, lon: -0.5 } },
			{ id: 'c-10km', start: { lat: 39.09, lon: -0.5 } },
			{ id: 'd-12km', start: { lat: 39.108, lon: -0.5 } },
			{ id: 'lejos-50km', start: { lat: 39.45, lon: -0.5 } }
		];
		expect(nearestAlternatives('yo', { lat: 39, lon: -0.5 }, all)).toEqual([
			'a-2km',
			'b-5km',
			'c-10km'
		]);
	});
});
