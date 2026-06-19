import { describe, expect, it } from 'vitest';
import {
	addCustomItem,
	emptyCustomGearData,
	exportCustomGear,
	parseCustomGearImport,
	removeCustomItem,
	CustomGearImportError
} from './customGear';

describe('material custom: mutaciones', () => {
	it('añade un ítem con id derivado del nombre (sin acentos)', () => {
		const d = addCustomItem(emptyCustomGearData(), {
			name: 'Calcetín Impermeable',
			category: 'ropa',
			weight_g: 90,
			attributes: ['impermeable', 'abrigo']
		});
		expect(d.items).toHaveLength(1);
		expect(d.items[0].id).toBe('calcetin-impermeable');
		expect(d.items[0].attributes).toEqual(['impermeable', 'abrigo']);
	});

	it('genera ids únicos ante nombres repetidos', () => {
		let d = emptyCustomGearData();
		d = addCustomItem(d, { name: 'Guantes', category: 'ropa', weight_g: null, attributes: [] });
		d = addCustomItem(d, { name: 'Guantes', category: 'ropa', weight_g: null, attributes: [] });
		expect(d.items.map((i) => i.id)).toEqual(['guantes', 'guantes-2']);
	});

	it('elimina por id', () => {
		let d = addCustomItem(emptyCustomGearData(), {
			name: 'Gorro',
			category: 'ropa',
			weight_g: 30,
			attributes: ['abrigo']
		});
		d = removeCustomItem(d, 'gorro');
		expect(d.items).toHaveLength(0);
	});
});

describe('material custom: export/import', () => {
	it('exporta e importa sin pérdida', () => {
		const d = addCustomItem(emptyCustomGearData(), {
			name: 'Polaina',
			category: 'ropa',
			weight_g: 120,
			attributes: ['impermeable']
		});
		expect(parseCustomGearImport(exportCustomGear(d))).toEqual(d);
	});

	it('rechaza un JSON inválido', () => {
		expect(() => parseCustomGearImport('{nope')).toThrow(CustomGearImportError);
	});

	it('rechaza atributos fuera del vocabulario', () => {
		const bad = JSON.stringify({
			schema: 1,
			items: [{ id: 'x', name: 'X', category: 'ropa', weight_g: null, attributes: ['volador'] }]
		});
		expect(() => parseCustomGearImport(bad)).toThrow(CustomGearImportError);
	});
});
