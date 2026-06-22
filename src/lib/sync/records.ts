/**
 * Conversión local ↔ registros sincronizables (SPECS_V4 §A2/§B2). Capa **pura**
 * que aplana los dominios de `src/lib/user/` a colecciones de `Syncable` (una por
 * tabla del backend) y los reconstruye. La fusión (`merge.ts`) opera sobre estas
 * colecciones; `SyncedRepository` usa estos conversores para no acoplar la lógica
 * de sincronización a la forma de almacenamiento de cada dominio.
 *
 * Tablas (ver `supabase/schema.sql`): `route_marks`, `outings`, `checklists`,
 * `custom_gear`, `preferences`. El `user_id` lo inyecta el `RemoteStore` desde la
 * sesión; estos registros son agnósticos del usuario.
 */

import type { Syncable } from '$lib/user/sync/merge';
import { type UserData, USER_SCHEMA_VERSION } from '$lib/user/marks';
import { CUSTOM_GEAR_SCHEMA_VERSION, type CustomGearData } from '$lib/user/customGear';
import type { ChecklistRow } from '$lib/user/checklist';
import type { Settings } from '$lib/settings';
import type { GearAttribute } from '$lib/types';

// ─── route_marks (toggles por ruta; sin tombstone) ─────────────────────────
export interface RouteMarkRecord extends Syncable {
	favorita: boolean;
	me_gusta: boolean;
	quiero_hacer: boolean;
}

// ─── outings (salidas; con tombstone) ──────────────────────────────────────
export interface OutingRecord extends Syncable {
	route_id: string;
	date: string;
	notes: string | null;
}

// ─── checklists (sin tombstone; vaciar = lista vacía) ──────────────────────
export interface ChecklistRecord extends Syncable {
	route_id: string;
	date: string;
	checked_ids: string[];
}

// ─── custom_gear (con tombstone) — coincide con el ítem almacenado ─────────
export interface CustomGearRecord extends Syncable {
	name: string;
	category: string;
	weight_g: number | null;
	attributes: GearAttribute[];
}

// ─── preferences (singleton) ───────────────────────────────────────────────
export interface PreferencesRecord {
	updated_at: string;
	data: Settings;
}

/**
 * Aplana las marcas de usuario en dos colecciones: `marks` (toggles por ruta) y
 * `outings`. Solo se emite un `RouteMarkRecord` cuando la ruta tiene
 * `updated_at` (i.e. los toggles se han tocado alguna vez); las salidas se
 * emiten siempre, incluidos los tombstones.
 */
export function marksToRecords(data: UserData): {
	marks: RouteMarkRecord[];
	outings: OutingRecord[];
} {
	const marks: RouteMarkRecord[] = [];
	const outings: OutingRecord[] = [];
	for (const [routeId, m] of Object.entries(data.marks)) {
		if (m.updated_at) {
			marks.push({
				id: routeId,
				favorita: !!m.favorita,
				me_gusta: !!m.me_gusta,
				quiero_hacer: !!m.quiero_hacer,
				updated_at: m.updated_at
			});
		}
		for (const o of m.outings ?? []) {
			outings.push({
				id: o.id,
				route_id: routeId,
				date: o.date,
				notes: o.notes ?? null,
				updated_at: o.updated_at,
				...(o.deleted ? { deleted: true } : {})
			});
		}
	}
	return { marks, outings };
}

/** Reconstruye `UserData` a partir de las dos colecciones fusionadas. */
export function recordsToMarks(marks: RouteMarkRecord[], outings: OutingRecord[]): UserData {
	const result: UserData['marks'] = {};
	for (const r of marks) {
		result[r.id] = {
			...(r.favorita ? { favorita: true } : {}),
			...(r.me_gusta ? { me_gusta: true } : {}),
			...(r.quiero_hacer ? { quiero_hacer: true } : {}),
			updated_at: r.updated_at
		};
	}
	const byRoute = new Map<string, OutingRecord[]>();
	for (const o of outings) {
		const list = byRoute.get(o.route_id) ?? [];
		list.push(o);
		byRoute.set(o.route_id, list);
	}
	for (const [routeId, list] of byRoute) {
		const entry = (result[routeId] ??= {});
		entry.outings = list
			.map((o) => ({
				id: o.id,
				date: o.date,
				...(o.notes ? { notes: o.notes } : {}),
				updated_at: o.updated_at,
				...(o.deleted ? { deleted: true } : {})
			}))
			.sort((a, b) => b.date.localeCompare(a.date));
	}
	return { schema: USER_SCHEMA_VERSION, marks: result };
}

/** Material custom: los ítems almacenados ya son registros sincronizables. */
export function customGearToRecords(data: CustomGearData): CustomGearRecord[] {
	return data.items.map((i) => ({
		id: i.id,
		name: i.name,
		category: i.category,
		weight_g: i.weight_g,
		attributes: i.attributes,
		updated_at: i.updated_at,
		...(i.deleted ? { deleted: true } : {})
	}));
}

export function recordsToCustomGear(records: CustomGearRecord[]): CustomGearData {
	return {
		schema: CUSTOM_GEAR_SCHEMA_VERSION,
		items: records.map((r) => ({
			id: r.id,
			name: r.name,
			category: r.category,
			weight_g: r.weight_g,
			attributes: r.attributes,
			updated_at: r.updated_at,
			...(r.deleted ? { deleted: true } : {})
		}))
	};
}

/** Separa la clave `"route|date"` en sus dos partes (la fecha no lleva `|`). */
function splitKey(key: string): { route_id: string; date: string } {
	const i = key.lastIndexOf('|');
	return i < 0
		? { route_id: key, date: '' }
		: { route_id: key.slice(0, i), date: key.slice(i + 1) };
}

export function checklistsToRecords(rows: ChecklistRow[]): ChecklistRecord[] {
	return rows.map((row) => {
		const { route_id, date } = splitKey(row.key);
		return { id: row.key, route_id, date, checked_ids: row.items, updated_at: row.updated_at };
	});
}

export function recordsToChecklists(records: ChecklistRecord[]): ChecklistRow[] {
	return records.map((r) => ({
		key: `${r.route_id}|${r.date}`,
		items: r.checked_ids,
		updated_at: r.updated_at
	}));
}

export function settingsToPreferences(settings: Settings): PreferencesRecord {
	return { updated_at: settings.updated_at, data: settings };
}

export function preferencesToSettings(record: PreferencesRecord): Settings {
	// El `updated_at` autoritativo es el de la fila, no el embebido en `data`.
	return { ...record.data, updated_at: record.updated_at };
}
