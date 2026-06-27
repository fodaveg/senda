import { describe, expect, it } from 'vitest';
import { ui } from './i18n';

describe('ui strings', () => {
	it('expone las cadenas de navegación esperadas', () => {
		expect(ui.nav.discover).toBe('Descubrir');
		expect(ui.nav.journal).toBe('Diario');
		expect(ui.nav.settings).toBe('Ajustes');
		expect(ui.nav.skipToContent).toBe('Saltar al contenido');
	});

	it('no contiene cadenas vacías', () => {
		const empties: string[] = [];
		const walk = (obj: Record<string, unknown>, path: string) => {
			for (const [k, v] of Object.entries(obj)) {
				if (typeof v === 'string') {
					if (v.trim() === '') empties.push(`${path}${k}`);
				} else if (v && typeof v === 'object') {
					walk(v as Record<string, unknown>, `${path}${k}.`);
				}
			}
		};
		walk(ui as unknown as Record<string, unknown>, '');
		expect(empties).toEqual([]);
	});
});
