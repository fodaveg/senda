import { describe, expect, it } from 'vitest';
import { PROVINCES, provinceOf } from './province';

describe('provinceOf', () => {
	it('mapea comarcas a su provincia', () => {
		expect(provinceOf('serranos')).toBe('valencia');
		expect(provinceOf('marina-alta')).toBe('alicante');
		expect(provinceOf('ports')).toBe('castellon');
		expect(provinceOf('plana-baixa')).toBe('castellon');
		expect(provinceOf('safor')).toBe('valencia');
		expect(provinceOf('comtat')).toBe('alicante');
	});

	it('devuelve null para comarca desconocida o ausente', () => {
		expect(provinceOf(null)).toBeNull();
		expect(provinceOf('no-existe')).toBeNull();
	});

	it('expone las tres provincias para el selector', () => {
		expect(PROVINCES.map((p) => p.id)).toEqual(['castellon', 'valencia', 'alicante']);
	});
});
