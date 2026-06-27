import { describe, expect, it } from 'vitest';
import { ROUTE_TYPE_LABELS, routeTypeLabel } from './routeType';

describe('routeTypeLabel', () => {
	it('devuelve el nombre completo de los tipos conocidos', () => {
		expect(routeTypeLabel('GR')).toBe('Gran Recorrido');
		expect(routeTypeLabel('PR')).toBe('Pequeño Recorrido');
		expect(routeTypeLabel('SL')).toBe('Sendero Local');
	});

	it('cae al propio código si el tipo no se reconoce', () => {
		expect(routeTypeLabel('XX')).toBe('XX');
		expect(routeTypeLabel('')).toBe('');
	});

	it('cubre todos los tipos del catálogo', () => {
		expect(Object.keys(ROUTE_TYPE_LABELS).sort()).toEqual(['GR', 'PR', 'SL']);
	});
});
