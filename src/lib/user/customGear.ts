/**
 * Material custom de mochila del usuario (SPECS_V3 §4). localStorage con
 * esquema versionado y validación zod, igual que las marcas (marks.ts). Los
 * atributos se validan contra el vocabulario cerrado. Diseñado anonimizable y
 * exportable de cara a la futura agregación de la v4 (SPECS_V3 §10): el ítem no
 * contiene datos personales, solo nombre, categoría, peso y atributos.
 *
 * Funciones de mutación puras (devuelven copia; el caller persiste).
 */

import { z } from 'zod';
import type { CustomGearItem, GearAttribute } from '$lib/types';
import { nowIso } from './sync/clock';

export const CUSTOM_GEAR_SCHEMA_VERSION = 2;
const STORAGE_KEY = 'senderos-cv:custom-gear';

const gearAttributeSchema = z.enum([
	'impermeable',
	'abrigo',
	'ventilado',
	'aislante',
	'sol',
	'lluvia',
	'calzado',
	'tecnico'
]);

const customGearItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	category: z.string().min(1),
	weight_g: z.number().nonnegative().nullable(),
	attributes: z.array(gearAttributeSchema),
	/** ISO 8601 del último cambio (LWW, SPECS_V4 §A2). */
	updated_at: z.string().min(1),
	/** Tombstone: ítem borrado (se propaga, no se muestra). */
	deleted: z.boolean().optional()
});

export const customGearDataSchema = z.object({
	schema: z.literal(CUSTOM_GEAR_SCHEMA_VERSION),
	items: z.array(customGearItemSchema)
});

export type CustomGearData = z.infer<typeof customGearDataSchema>;

export function emptyCustomGearData(): CustomGearData {
	return { schema: CUSTOM_GEAR_SCHEMA_VERSION, items: [] };
}

/**
 * Lleva un objeto crudo a la forma v2 (best-effort). v1 (ítems sin `updated_at`)
 * se migra backfilleando ese campo con `now`, sin perder ningún dato.
 */
export function migrateCustomGear(json: unknown, now: string = nowIso()): unknown {
	if (!json || typeof json !== 'object') return json;
	const obj = json as Record<string, unknown>;
	if (obj.schema === CUSTOM_GEAR_SCHEMA_VERSION) return json;
	if (obj.schema !== 1) return json; // esquema desconocido → que zod lo rechace
	const items = Array.isArray(obj.items) ? (obj.items as Record<string, unknown>[]) : [];
	return {
		schema: CUSTOM_GEAR_SCHEMA_VERSION,
		items: items.map((i) => ({ ...i, updated_at: now }))
	};
}

export function loadCustomGear(): CustomGearData {
	if (typeof localStorage === 'undefined') return emptyCustomGearData();
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return emptyCustomGearData();
	try {
		const parsed = customGearDataSchema.safeParse(migrateCustomGear(JSON.parse(raw)));
		return parsed.success ? parsed.data : emptyCustomGearData();
	} catch {
		return emptyCustomGearData();
	}
}

/** Ítems vivos (sin tombstones), para mostrar y para el motor de mochila. */
export function liveCustomItems(data: CustomGearData): CustomGearItem[] {
	return data.items.filter((i) => !i.deleted);
}

export function saveCustomGear(data: CustomGearData): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Slug estable a partir del nombre (sin acentos, kebab-case). */
function slugify(name: string): string {
	return (
		name
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') || 'item'
	);
}

export interface NewCustomItem {
	name: string;
	category: string;
	weight_g: number | null;
	attributes: GearAttribute[];
}

/** Añade un ítem con id único derivado del nombre (puro). */
export function addCustomItem(
	data: CustomGearData,
	input: NewCustomItem,
	now: string = nowIso()
): CustomGearData {
	const base = slugify(input.name);
	let id = base;
	let n = 2;
	const taken = new Set(data.items.map((i) => i.id));
	while (taken.has(id)) id = `${base}-${n++}`;
	const item = {
		id,
		name: input.name,
		category: input.category,
		weight_g: input.weight_g,
		attributes: input.attributes,
		updated_at: now
	};
	return { ...data, items: [...data.items, item] };
}

/** Borra un ítem por id como tombstone (`deleted`), para propagar el borrado. */
export function removeCustomItem(
	data: CustomGearData,
	id: string,
	now: string = nowIso()
): CustomGearData {
	return {
		...data,
		items: data.items.map((i) => (i.id === id ? { ...i, deleted: true, updated_at: now } : i))
	};
}

export function exportCustomGear(data: CustomGearData): string {
	return JSON.stringify(data, null, '\t') + '\n';
}

export class CustomGearImportError extends Error {}

/** Valida una copia de seguridad; nunca aplica datos a medias. */
export function parseCustomGearImport(raw: string): CustomGearData {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new CustomGearImportError('El fichero no es JSON válido.');
	}
	const result = customGearDataSchema.safeParse(migrateCustomGear(json));
	if (!result.success) {
		throw new CustomGearImportError(
			`El material custom no valida:\n${z.prettifyError(result.error)}`
		);
	}
	return result.data;
}
