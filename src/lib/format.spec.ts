import { describe, expect, it } from 'vitest';
import { formatDuration, formatKm, formatMeters } from './format';

describe('formatKm', () => {
	it('usa coma decimal y una cifra decimal', () => {
		expect(formatKm(11.2)).toBe('11,2 km');
	});

	it('omite decimales cuando la distancia es entera', () => {
		expect(formatKm(8)).toBe('8 km');
	});
});

describe('formatMeters', () => {
	it('redondea a metros enteros', () => {
		expect(formatMeters(420.4)).toBe('420 m');
	});
});

describe('formatDuration', () => {
	it('minutos sueltos', () => {
		expect(formatDuration(45)).toBe('45 min');
	});

	it('horas exactas', () => {
		expect(formatDuration(120)).toBe('2 h');
	});

	it('horas y minutos', () => {
		expect(formatDuration(370)).toBe('6 h 10 min');
	});
});
