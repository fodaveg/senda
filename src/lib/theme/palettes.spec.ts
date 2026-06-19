import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE_ID, PALETTES, getPalette } from './palettes';

describe('paletas de color', () => {
	it('la paleta por defecto existe y es la primera', () => {
		expect(getPalette(DEFAULT_PALETTE_ID).id).toBe('bosque');
		expect(PALETTES[0].id).toBe(DEFAULT_PALETTE_ID);
	});

	it('un id desconocido cae a la paleta por defecto', () => {
		expect(getPalette('no-existe').id).toBe(DEFAULT_PALETTE_ID);
	});

	it('cada paleta define acento y encabezado en tono claro y oscuro', () => {
		for (const p of PALETTES) {
			expect(p.accent).toHaveLength(2);
			expect(p.header).toHaveLength(2);
			for (const c of [...p.accent, ...p.header]) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it('los ids son únicos', () => {
		expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
	});
});
