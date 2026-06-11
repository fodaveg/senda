/**
 * Marcas de usuario y diario de salidas (SPECS_V2 §3/§8): favorita,
 * me gusta, quiero hacer y salidas realizadas ("hecha" = ≥1 salida).
 * localStorage con esquema versionado y validación zod; exportación e
 * importación JSON para copia de seguridad. Nunca se pierde el dato del
 * usuario: un almacén corrupto se ignora, no se sobreescribe hasta el
 * siguiente guardado explícito.
 */

import { z } from 'zod';

export const USER_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'senderos-cv:user';

export type ToggleMark = 'favorita' | 'me_gusta' | 'quiero_hacer';
export const TOGGLE_MARKS: ToggleMark[] = ['favorita', 'me_gusta', 'quiero_hacer'];

const outingSchema = z.object({
	/** YYYY-MM-DD. */
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	notes: z.string().optional()
});

const routeMarksSchema = z.object({
	favorita: z.boolean().optional(),
	me_gusta: z.boolean().optional(),
	quiero_hacer: z.boolean().optional(),
	outings: z.array(outingSchema).optional()
});

export const userDataSchema = z.object({
	schema: z.literal(USER_SCHEMA_VERSION),
	marks: z.record(z.string(), routeMarksSchema)
});

export type Outing = z.infer<typeof outingSchema>;
export type RouteMarks = z.infer<typeof routeMarksSchema>;
export type UserData = z.infer<typeof userDataSchema>;

export function emptyUserData(): UserData {
	return { schema: USER_SCHEMA_VERSION, marks: {} };
}

export function loadUserData(): UserData {
	if (typeof localStorage === 'undefined') return emptyUserData();
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return emptyUserData();
	try {
		const parsed = userDataSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : emptyUserData();
	} catch {
		return emptyUserData();
	}
}

export function saveUserData(data: UserData): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isDone(marks: RouteMarks | undefined): boolean {
	return (marks?.outings?.length ?? 0) > 0;
}

/** Devuelve una copia con la marca invertida (puro; el caller persiste). */
export function withToggledMark(data: UserData, routeId: string, mark: ToggleMark): UserData {
	const current = data.marks[routeId] ?? {};
	const next = { ...current, [mark]: !current[mark] };
	return { ...data, marks: { ...data.marks, [routeId]: next } };
}

/** Añade una salida (ruta hecha) ordenada por fecha descendente. */
export function withOuting(data: UserData, routeId: string, outing: Outing): UserData {
	const current = data.marks[routeId] ?? {};
	const outings = [...(current.outings ?? []), outing].sort((a, b) => b.date.localeCompare(a.date));
	return { ...data, marks: { ...data.marks, [routeId]: { ...current, outings } } };
}

export function withoutOuting(data: UserData, routeId: string, index: number): UserData {
	const current = data.marks[routeId];
	if (!current?.outings) return data;
	const outings = current.outings.filter((_, i) => i !== index);
	return { ...data, marks: { ...data.marks, [routeId]: { ...current, outings } } };
}

export function exportUserData(data: UserData): string {
	return JSON.stringify(data, null, '\t') + '\n';
}

export class UserImportError extends Error {}

/** Valida una copia de seguridad; nunca aplica datos a medias. */
export function parseUserDataImport(raw: string): UserData {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new UserImportError('El fichero no es JSON válido.');
	}
	const result = userDataSchema.safeParse(json);
	if (!result.success) {
		throw new UserImportError(`La copia de seguridad no valida:\n${z.prettifyError(result.error)}`);
	}
	return result.data;
}
