import { describe, expect, it } from 'vitest';
import {
	dedupePois,
	nearestAlternatives,
	parseOverpass,
	pointInRing,
	poisAlongTrack,
	shadeRatioOfTrack,
	waterPointsAlongTrack,
	waterPointsGeoAlongTrack
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

describe('parseOverpass: POIs', () => {
	it('clasifica miradores, cumbres, patrimonio y refugios con nombre', () => {
		const { pois } = parseOverpass({
			elements: [
				{ type: 'node', lat: 39, lon: -0.5, tags: { tourism: 'viewpoint', name: 'Mirador' } },
				{ type: 'node', lat: 39.01, lon: -0.5, tags: { natural: 'peak', name: 'El Pico' } },
				{ type: 'node', lat: 39.02, lon: -0.5, tags: { historic: 'castle', name: 'Castillo' } },
				{ type: 'node', lat: 39.03, lon: -0.5, tags: { amenity: 'shelter', name: 'Refugio' } },
				// Sin nombre: se omite (no se inventa).
				{ type: 'node', lat: 39.04, lon: -0.5, tags: { natural: 'peak' } }
			]
		});
		expect(pois.map((p) => p.type)).toEqual(['mirador', 'cumbre', 'patrimonio', 'refugio']);
	});
});

describe('waterPointsGeoAlongTrack', () => {
	it('devuelve coordenadas y posición de las fuentes a ≤100 m', () => {
		const water = [
			{ lat: 39.005, lon: -0.5, name: 'Font del Mig', kind: 'fuente' as const },
			{ lat: 39.0, lon: -0.49, name: null, kind: 'manantial' as const } // fuera
		];
		const geo = waterPointsGeoAlongTrack(water, TRACK);
		expect(geo).toHaveLength(1);
		expect(geo[0]).toMatchObject({ name: 'Font del Mig', kind: 'fuente', lat: 39.005, lon: -0.5 });
		expect(geo[0].dist_m).toBeLessThanOrEqual(100);
	});
});

describe('poisAlongTrack', () => {
	it('incluye solo POIs a ≤150 m, ordenados por km', () => {
		const pois = [
			{ name: 'Mirador', type: 'mirador' as const, lat: 39.003, lon: -0.5 },
			{ name: 'Lejos', type: 'cumbre' as const, lat: 39.0, lon: -0.48 } // fuera
		];
		const found = poisAlongTrack(pois, TRACK);
		expect(found).toHaveLength(1);
		expect(found[0].name).toBe('Mirador');
		expect(found[0].dist_m).toBeLessThanOrEqual(150);
	});
});

describe('dedupePois', () => {
	it('colapsa POIs del mismo nombre/tipo cercanos y deja el más próximo al track', () => {
		const pois = [
			{ name: 'Penyagolosa', type: 'cumbre' as const, lat: 40.2, lon: -0.3, km: 5, dist_m: 80 },
			// Mismo nombre/tipo a ~25 m (nodo + vía de OSM) → duplicado.
			{
				name: 'penyagolosa',
				type: 'cumbre' as const,
				lat: 40.20022,
				lon: -0.3,
				km: 5.1,
				dist_m: 20
			},
			{ name: 'Mirador', type: 'mirador' as const, lat: 40.25, lon: -0.31, km: 8, dist_m: 40 }
		];
		const out = dedupePois(pois);
		expect(out).toHaveLength(2);
		const cumbre = out.find((p) => p.type === 'cumbre');
		// Se conserva el más cercano al track (dist_m 20).
		expect(cumbre?.dist_m).toBe(20);
	});

	it('no colapsa mismo nombre lejos (>60 m) ni distinto tipo', () => {
		const pois = [
			{ name: 'Font', type: 'patrimonio' as const, lat: 40.2, lon: -0.3, km: 1, dist_m: 10 },
			{ name: 'Font', type: 'patrimonio' as const, lat: 40.203, lon: -0.3, km: 2, dist_m: 12 }, // ~330 m
			{ name: 'Font', type: 'refugio' as const, lat: 40.2, lon: -0.3, km: 1, dist_m: 10 } // distinto tipo
		];
		expect(dedupePois(pois)).toHaveLength(3);
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
