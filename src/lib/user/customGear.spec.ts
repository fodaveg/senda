import { describe, expect, it } from 'vitest';
import {
	addCustomItem,
	customGearDataSchema,
	emptyCustomGearData,
	exportCustomGear,
	liveCustomItems,
	migrateCustomGear,
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

	it('elimina por id como tombstone (deja de mostrarse, se conserva para sync)', () => {
		let d = addCustomItem(emptyCustomGearData(), {
			name: 'Gorro',
			category: 'ropa',
			weight_g: 30,
			attributes: ['abrigo']
		});
		d = removeCustomItem(d, 'gorro');
		expect(liveCustomItems(d)).toHaveLength(0);
		expect(d.items).toHaveLength(1);
		expect(d.items[0].deleted).toBe(true);
	});

	it('migra v1→v2 backfilleando updated_at sin perder ítems', () => {
		const v1 = {
			schema: 1,
			items: [
				{ id: 'gorro', name: 'Gorro', category: 'ropa', weight_g: 30, attributes: ['abrigo'] }
			]
		};
		const migrated = customGearDataSchema.parse(migrateCustomGear(v1, '2026-06-22T10:00:00.000Z'));
		expect(migrated.schema).toBe(2);
		expect(migrated.items[0]).toMatchObject({
			id: 'gorro',
			updated_at: '2026-06-22T10:00:00.000Z'
		});
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
