import { describe, expect, it } from 'vitest';
import { cellSizeDeg, clusterMarkers, type MarkerPoint } from './cluster';

const P = (id: string, lat: number, lon: number): MarkerPoint => ({ id, lat, lon, name: id });

describe('clusterMarkers', () => {
	it('agrupa puntos cercanos a poco zoom y los separa al acercar', () => {
		const points = [P('a', 39.0, -0.5), P('b', 39.05, -0.45), P('c', 39.9, -0.9)];
		// A zoom bajo, a y b caen en la misma celda; c en otra.
		const low = clusterMarkers(points, 6);
		expect(low.length).toBeLessThan(points.length);
		const cluster = low.find((c) => c.members.length > 1);
		expect(cluster?.members.map((m) => m.id).sort()).toEqual(['a', 'b']);
		// A zoom alto, cada punto queda aislado.
		const high = clusterMarkers(points, 14);
		expect(high).toHaveLength(3);
		expect(high.every((c) => c.members.length === 1)).toBe(true);
	});

	it('un único punto es un grupo de un miembro (marcador individual)', () => {
		const [only] = clusterMarkers([P('x', 38.7, -0.4)], 7);
		expect(only.members).toHaveLength(1);
		expect(only.lat).toBeCloseTo(38.7);
		expect(only.lon).toBeCloseTo(-0.4);
	});

	it('el centroide es la media de los miembros', () => {
		const [c] = clusterMarkers([P('a', 39.0, -0.5), P('b', 39.2, -0.7)], 3);
		expect(c.members).toHaveLength(2);
		expect(c.lat).toBeCloseTo(39.1);
		expect(c.lon).toBeCloseTo(-0.6);
	});

	it('la celda se encoge a la mitad por cada nivel de zoom', () => {
		expect(cellSizeDeg(7)).toBeCloseTo(cellSizeDeg(6) / 2);
	});
});
