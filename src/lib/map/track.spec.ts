import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { trackEndpoints } from './track';

function lineString(coords: [number, number][]): FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: [
			{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
		]
	};
}

describe('trackEndpoints', () => {
	it('devuelve inicio y fin de un track lineal', () => {
		const fc = lineString([
			[-0.9, 39.6],
			[-0.8, 39.7],
			[-0.7, 39.65]
		]);
		const ep = trackEndpoints(fc);
		expect(ep).not.toBeNull();
		expect(ep!.start).toEqual([-0.9, 39.6]);
		expect(ep!.end).toEqual([-0.7, 39.65]);
		expect(ep!.circular).toBe(false);
	});

	it('marca circular cuando inicio y fin casi coinciden', () => {
		const fc = lineString([
			[-0.9, 39.6],
			[-0.8, 39.7],
			[-0.90001, 39.60001]
		]);
		const ep = trackEndpoints(fc);
		expect(ep!.circular).toBe(true);
	});

	it('devuelve null sin coordenadas suficientes', () => {
		expect(trackEndpoints(lineString([[-0.9, 39.6]]))).toBeNull();
		expect(trackEndpoints({ type: 'FeatureCollection', features: [] })).toBeNull();
	});

	it('atraviesa MultiLineString concatenando los segmentos', () => {
		const fc: FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'MultiLineString',
						coordinates: [
							[
								[-1, 40],
								[-1.1, 40.1]
							],
							[
								[-1.1, 40.1],
								[-1.2, 40.2]
							]
						]
					}
				}
			]
		};
		const ep = trackEndpoints(fc);
		expect(ep!.start).toEqual([-1, 40]);
		expect(ep!.end).toEqual([-1.2, 40.2]);
	});
});
