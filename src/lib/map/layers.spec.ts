import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYER_ID, MAP_LAYERS, getLayer } from './layers';

describe('catálogo de capas del mapa', () => {
	it('incluye la capa por defecto y es offline', () => {
		const def = getLayer(DEFAULT_LAYER_ID);
		expect(def.id).toBe('mtn');
		expect(def.offline).toBe(true);
	});

	it('solo la capa por defecto es offline (el resto requiere red)', () => {
		const offline = MAP_LAYERS.filter((l) => l.offline);
		expect(offline).toHaveLength(1);
		expect(offline[0].id).toBe(DEFAULT_LAYER_ID);
	});

	it('un id desconocido cae a la capa por defecto', () => {
		expect(getLayer('no-existe').id).toBe(DEFAULT_LAYER_ID);
	});

	it('cada capa construye una URL de tile WMTS del IGN', () => {
		for (const layer of MAP_LAYERS) {
			const url = layer.tileUrl(12, 2010, 1500);
			expect(url).toContain('ign.es/wmts');
			expect(url).toContain('TileMatrix=12');
			expect(url).toContain('TileCol=2010');
			expect(url).toContain('TileRow=1500');
		}
	});

	it('los ids son únicos', () => {
		expect(new Set(MAP_LAYERS.map((l) => l.id)).size).toBe(MAP_LAYERS.length);
	});
});
