import { describe, expect, it } from 'vitest';
import { latToTileY, lonToTileX, tileListForBbox, tileStoreKey } from './tiles';

describe('matemática slippy-map', () => {
	it('coincide con el ejemplo de referencia de la wiki de OSM', () => {
		// zoom 17, lat 51.51202 lon 0.02435 → tile 65544/43582
		expect(lonToTileX(0.02435, 17)).toBe(65544);
		expect(latToTileY(51.51202, 17)).toBe(43582);
	});
});

describe('tileListForBbox', () => {
	const CHULILLA: [number, number, number, number] = [-0.93, 39.63, -0.87, 39.67];

	it('cubre el bbox en los zooms pedidos sin pasarse del tope', () => {
		const tiles = tileListForBbox(CHULILLA, [11, 15], 600);
		expect(tiles.length).toBeGreaterThan(20);
		expect(tiles.length).toBeLessThanOrEqual(600);
		expect(tiles.some((t) => t.z === 11)).toBe(true);
		expect(new Set(tiles.map(tileStoreKey)).size).toBe(tiles.length);
	});

	it('con bbox grande recorta el zoom máximo antes que superar el tope', () => {
		const huge: [number, number, number, number] = [-1.5, 38.7, 0.5, 40.5];
		const tiles = tileListForBbox(huge, [11, 15], 600);
		expect(tiles.length).toBeLessThanOrEqual(600);
		expect(Math.max(...tiles.map((t) => t.z))).toBeLessThan(15);
	});
});
