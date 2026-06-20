import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '$lib/settings';
import {
	activeScheme,
	DARK_SCHEMES,
	DEFAULT_DARK_SCHEME,
	DEFAULT_LIGHT_SCHEME,
	effectiveMode,
	getScheme,
	LIGHT_SCHEMES
} from './schemes';

describe('catálogo de esquemas', () => {
	it('los esquemas claros son modo claro y los oscuros modo oscuro', () => {
		expect(LIGHT_SCHEMES.every((s) => s.mode === 'claro')).toBe(true);
		expect(DARK_SCHEMES.every((s) => s.mode === 'oscuro')).toBe(true);
	});

	it('ids únicos y swatches no vacíos', () => {
		const ids = [...LIGHT_SCHEMES, ...DARK_SCHEMES].map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of [...LIGHT_SCHEMES, ...DARK_SCHEMES])
			expect(s.swatches.length).toBeGreaterThan(0);
	});

	it('cada esquema define todos los tokens de color', () => {
		const keys = [
			'bg',
			'surface',
			'surfaceAlt',
			'border',
			'ink',
			'muted',
			'mutedStrong',
			'brand',
			'brandStrong',
			'onBrand',
			'alertBg',
			'alertBorder',
			'alertInk'
		];
		for (const s of [...LIGHT_SCHEMES, ...DARK_SCHEMES]) {
			for (const k of keys) expect(s.tokens[k as keyof typeof s.tokens]).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});

describe('getScheme', () => {
	it('devuelve el esquema por id dentro de su modo', () => {
		expect(getScheme('noche-azul', 'oscuro').name).toBe('Noche azul');
		expect(getScheme('mar-claro', 'claro').name).toBe('Mar');
	});

	it('cae al por defecto del modo si el id no existe', () => {
		expect(getScheme('inexistente', 'claro').id).toBe(DEFAULT_LIGHT_SCHEME);
		expect(getScheme('inexistente', 'oscuro').id).toBe(DEFAULT_DARK_SCHEME);
		// No mezcla modos: un id oscuro pedido en modo claro cae al claro por defecto.
		expect(getScheme('noche-azul', 'claro').id).toBe(DEFAULT_LIGHT_SCHEME);
	});
});

describe('effectiveMode / activeScheme', () => {
	it('resuelve el modo del tema (en test, "auto" = claro sin matchMedia)', () => {
		expect(effectiveMode('oscuro')).toBe('oscuro');
		expect(effectiveMode('claro')).toBe('claro');
		expect(effectiveMode('auto')).toBe('claro');
	});

	it('elige el esquema del modo activo', () => {
		expect(activeScheme({ ...DEFAULT_SETTINGS, theme: 'oscuro', schemeDark: 'carbon' }).id).toBe(
			'carbon'
		);
		expect(activeScheme({ ...DEFAULT_SETTINGS, theme: 'claro', schemeLight: 'mar-claro' }).id).toBe(
			'mar-claro'
		);
	});
});
