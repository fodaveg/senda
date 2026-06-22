/**
 * Marcas de usuario y diario de salidas (SPECS_V2 §3/§8): favorita,
 * me gusta, quiero hacer y salidas realizadas ("hecha" = ≥1 salida).
 * localStorage con esquema versionado y validación zod; exportación e
 * importación JSON para copia de seguridad. Nunca se pierde el dato del
 * usuario: un almacén corrupto se ignora, no se sobreescribe hasta el
 * siguiente guardado explícito.
 *
 * **v2 (SPECS_V4 §A2 — sincronizable):** cada conjunto de marcas por ruta lleva
 * `updated_at` (último cambio de los toggles) y cada salida es un registro
 * sincronizable (`id` + `updated_at` + tombstone `deleted`). Borrar una salida
 * no la elimina del array, la marca como `deleted` para que el borrado se
 * propague a otros dispositivos; los consumidores muestran solo las salidas
 * vivas (`liveOutings`). La migración v1→v2 backfillea ids y `updated_at` sin
 * perder ningún dato.
 */

import { z } from 'zod';
import { newId, nowIso } from './sync/clock';

export const USER_SCHEMA_VERSION = 2;
const STORAGE_KEY = 'senderos-cv:user';

export type ToggleMark = 'favorita' | 'me_gusta' | 'quiero_hacer';
export const TOGGLE_MARKS: ToggleMark[] = ['favorita', 'me_gusta', 'quiero_hacer'];

const outingSchema = z.object({
	/** Id estable de la salida (para sincronización por elemento). */
	id: z.string().min(1),
	/** YYYY-MM-DD. */
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	notes: z.string().optional(),
	/** ISO 8601 del último cambio (LWW). */
	updated_at: z.string().min(1),
	/** Tombstone: salida borrada (se propaga, no se muestra). */
	deleted: z.boolean().optional()
});

const routeMarksSchema = z.object({
	favorita: z.boolean().optional(),
	me_gusta: z.boolean().optional(),
	quiero_hacer: z.boolean().optional(),
	outings: z.array(outingSchema).optional(),
	/** ISO 8601 del último cambio de los toggles de esta ruta (LWW). */
	updated_at: z.string().min(1).optional()
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

/**
 * Lleva un objeto crudo a la forma v2 (best-effort). Si ya es v2 o de un
 * esquema desconocido, lo devuelve tal cual para que la validación zod decida.
 * Migra v1 (marcas sin `updated_at`, salidas sin `id`/`updated_at`)
 * backfilleando esos campos con `now`/ids nuevos, sin perder ningún dato.
 */
export function migrateUserData(json: unknown, now: string = nowIso()): unknown {
	if (!json || typeof json !== 'object') return json;
	const obj = json as Record<string, unknown>;
	if (obj.schema === USER_SCHEMA_VERSION) return json;
	if (obj.schema !== 1) return json; // esquema desconocido → que zod lo rechace
	const marks = (obj.marks && typeof obj.marks === 'object' ? obj.marks : {}) as Record<
		string,
		Record<string, unknown>
	>;
	const migrated: Record<string, unknown> = {};
	for (const [routeId, m] of Object.entries(marks)) {
		const rawOutings = Array.isArray(m?.outings) ? (m.outings as Record<string, unknown>[]) : null;
		const outings = rawOutings?.map((o) => ({ ...o, id: newId(), updated_at: now }));
		migrated[routeId] = { ...m, updated_at: now, ...(outings ? { outings } : {}) };
	}
	return { schema: USER_SCHEMA_VERSION, marks: migrated };
}

/** Valida (y migra) un objeto crudo; `null` si es irrecuperable. */
function coerceUserData(json: unknown): UserData | null {
	const parsed = userDataSchema.safeParse(migrateUserData(json));
	return parsed.success ? parsed.data : null;
}

export function loadUserData(): UserData {
	if (typeof localStorage === 'undefined') return emptyUserData();
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return emptyUserData();
	try {
		return coerceUserData(JSON.parse(raw)) ?? emptyUserData();
	} catch {
		return emptyUserData();
	}
}

export function saveUserData(data: UserData): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Salidas vivas (sin tombstones), para mostrar y contar. */
export function liveOutings(marks: RouteMarks | undefined): Outing[] {
	return (marks?.outings ?? []).filter((o) => !o.deleted);
}

export function isDone(marks: RouteMarks | undefined): boolean {
	return liveOutings(marks).length > 0;
}

/** Devuelve una copia con la marca invertida (puro; el caller persiste). */
export function withToggledMark(
	data: UserData,
	routeId: string,
	mark: ToggleMark,
	now: string = nowIso()
): UserData {
	const current = data.marks[routeId] ?? {};
	const next = { ...current, [mark]: !current[mark], updated_at: now };
	return { ...data, marks: { ...data.marks, [routeId]: next } };
}

/** Datos de una salida nueva (el id y el `updated_at` los pone `withOuting`). */
export type NewOuting = { date: string; notes?: string };

/** Añade una salida (ruta hecha) ordenada por fecha descendente. */
export function withOuting(
	data: UserData,
	routeId: string,
	outing: NewOuting,
	now: string = nowIso(),
	id: string = newId()
): UserData {
	const current = data.marks[routeId] ?? {};
	const full: Outing = {
		id,
		date: outing.date,
		...(outing.notes ? { notes: outing.notes } : {}),
		updated_at: now
	};
	const outings = [...(current.outings ?? []), full].sort((a, b) => b.date.localeCompare(a.date));
	return { ...data, marks: { ...data.marks, [routeId]: { ...current, outings } } };
}

/**
 * Borra una salida por id marcándola como tombstone (`deleted`) y actualizando
 * su `updated_at`, para que el borrado se propague en la sincronización.
 */
export function withoutOuting(
	data: UserData,
	routeId: string,
	outingId: string,
	now: string = nowIso()
): UserData {
	const current = data.marks[routeId];
	if (!current?.outings) return data;
	const outings = current.outings.map((o) =>
		o.id === outingId ? { ...o, deleted: true, updated_at: now } : o
	);
	return { ...data, marks: { ...data.marks, [routeId]: { ...current, outings } } };
}

export function exportUserData(data: UserData): string {
	return JSON.stringify(data, null, '\t') + '\n';
}

export class UserImportError extends Error {}

/** Valida (y migra) una copia de seguridad; nunca aplica datos a medias. */
export function parseUserDataImport(raw: string): UserData {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		throw new UserImportError('El fichero no es JSON válido.');
	}
	const result = userDataSchema.safeParse(migrateUserData(json));
	if (!result.success) {
		throw new UserImportError(`La copia de seguridad no valida:\n${z.prettifyError(result.error)}`);
	}
	return result.data;
}
