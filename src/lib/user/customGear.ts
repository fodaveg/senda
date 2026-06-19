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

export const CUSTOM_GEAR_SCHEMA_VERSION = 1;
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
	attributes: z.array(gearAttributeSchema)
});

export const customGearDataSchema = z.object({
	schema: z.literal(CUSTOM_GEAR_SCHEMA_VERSION),
	items: z.array(customGearItemSchema)
});

export type CustomGearData = z.infer<typeof customGearDataSchema>;

export function emptyCustomGearData(): CustomGearData {
	return { schema: CUSTOM_GEAR_SCHEMA_VERSION, items: [] };
}

export function loadCustomGear(): CustomGearData {
	if (typeof localStorage === 'undefined') return emptyCustomGearData();
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return emptyCustomGearData();
	try {
		const parsed = customGearDataSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : emptyCustomGearData();
	} catch {
		return emptyCustomGearData();
	}
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
export function addCustomItem(data: CustomGearData, input: NewCustomItem): CustomGearData {
	const base = slugify(input.name);
	let id = base;
	let n = 2;
	const taken = new Set(data.items.map((i) => i.id));
	while (taken.has(id)) id = `${base}-${n++}`;
	const item: CustomGearItem = {
		id,
		name: input.name,
		category: input.category,
		weight_g: input.weight_g,
		attributes: input.attributes
	};
	return { ...data, items: [...data.items, item] };
}

export function removeCustomItem(data: CustomGearData, id: string): CustomGearData {
	return { ...data, items: data.items.filter((i) => i.id !== id) };
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
	const result = customGearDataSchema.safeParse(json);
	if (!result.success) {
		throw new CustomGearImportError(
			`El material custom no valida:\n${z.prettifyError(result.error)}`
		);
	}
	return result.data;
}
