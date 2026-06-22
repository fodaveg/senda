/**
 * Implementación de `RemoteStore` sobre **Supabase** (SPECS_V4 §B2). Usa el
 * cliente compartido (misma sesión que la autenticación) y valida con **zod**
 * todo lo que baja del backend (límite de datos externos). El `user_id` lo
 * inyecta esta capa desde la sesión en cada upsert; el RLS del servidor
 * (`auth.uid() = user_id`) garantiza el aislamiento.
 *
 * Degradación elegante: una fila remota que no valide se descarta con un aviso
 * (no rompe la sincronización); un error de consulta se propaga para que el
 * repositorio marque "sin conexión" y reintente, sin perder dato local.
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackendConfig } from '$lib/config';
import { getSupabaseClient } from '$lib/supabase/client';
import { coerceSettings } from '$lib/settings';
import type { RemoteStore } from './remote';
import type {
	ChecklistRecord,
	CustomGearRecord,
	OutingRecord,
	PreferencesRecord,
	RouteMarkRecord
} from './records';

const gearAttribute = z.enum([
	'impermeable',
	'abrigo',
	'ventilado',
	'aislante',
	'sol',
	'lluvia',
	'calzado',
	'tecnico'
]);

const routeMarkRow = z.object({
	route_id: z.string(),
	favorita: z.boolean(),
	me_gusta: z.boolean(),
	quiero_hacer: z.boolean(),
	updated_at: z.string()
});
const outingRow = z.object({
	id: z.string(),
	route_id: z.string(),
	date: z.string(),
	notes: z.string().nullable(),
	deleted: z.boolean(),
	updated_at: z.string()
});
const checklistRow = z.object({
	route_id: z.string(),
	date: z.string(),
	checked_ids: z.array(z.string()),
	updated_at: z.string()
});
const customGearRow = z.object({
	id: z.string(),
	name: z.string(),
	category: z.string(),
	weight_g: z.number().nullable(),
	attributes: z.array(gearAttribute),
	deleted: z.boolean(),
	updated_at: z.string()
});
const preferencesRow = z.object({
	data: z.record(z.string(), z.unknown()),
	updated_at: z.string()
});

/** Valida cada fila; descarta (con aviso) las que no cumplen — sin romper. */
function parseRows<T>(rows: unknown[], schema: z.ZodType<T>, table: string): T[] {
	const out: T[] = [];
	for (const row of rows) {
		const parsed = schema.safeParse(row);
		if (parsed.success) out.push(parsed.data);
		else console.warn(`[sync] fila inválida en ${table}, descartada:`, parsed.error.issues);
	}
	return out;
}

/** Crea un `RemoteStore` respaldado por Supabase, autenticado con la sesión. */
export function createSupabaseRemoteStore(config: BackendConfig): RemoteStore {
	const client = () => getSupabaseClient(config);

	/** Id del usuario con sesión; lanza si no hay (no se debe sincronizar sin ella). */
	async function userId(sb: SupabaseClient): Promise<string> {
		const { data, error } = await sb.auth.getUser();
		if (error || !data.user) throw new Error('Sin sesión para sincronizar.');
		return data.user.id;
	}

	/** Ejecuta una consulta y propaga el error del backend como excepción. */
	function rows<T>(result: { data: T[] | null; error: { message: string } | null }): T[] {
		if (result.error) throw new Error(result.error.message);
		return result.data ?? [];
	}

	return {
		async loadRouteMarks() {
			const sb = await client();
			const data = rows(
				await sb
					.from('route_marks')
					.select('route_id, favorita, me_gusta, quiero_hacer, updated_at')
			);
			return parseRows(data, routeMarkRow, 'route_marks').map((r) => ({
				id: r.route_id,
				favorita: r.favorita,
				me_gusta: r.me_gusta,
				quiero_hacer: r.quiero_hacer,
				updated_at: r.updated_at
			}));
		},
		async upsertRouteMarks(records: RouteMarkRecord[]) {
			const sb = await client();
			const uid = await userId(sb);
			const { error } = await sb.from('route_marks').upsert(
				records.map((r) => ({
					user_id: uid,
					route_id: r.id,
					favorita: r.favorita,
					me_gusta: r.me_gusta,
					quiero_hacer: r.quiero_hacer,
					updated_at: r.updated_at
				})),
				{ onConflict: 'user_id,route_id' }
			);
			if (error) throw new Error(error.message);
		},

		async loadOutings() {
			const sb = await client();
			const data = rows(
				await sb.from('outings').select('id, route_id, date, notes, deleted, updated_at')
			);
			return parseRows(data, outingRow, 'outings').map((r) => ({
				id: r.id,
				route_id: r.route_id,
				date: r.date,
				notes: r.notes,
				updated_at: r.updated_at,
				...(r.deleted ? { deleted: true } : {})
			}));
		},
		async upsertOutings(records: OutingRecord[]) {
			const sb = await client();
			const uid = await userId(sb);
			const { error } = await sb.from('outings').upsert(
				records.map((r) => ({
					id: r.id,
					user_id: uid,
					route_id: r.route_id,
					date: r.date,
					notes: r.notes,
					deleted: !!r.deleted,
					updated_at: r.updated_at
				})),
				{ onConflict: 'id' }
			);
			if (error) throw new Error(error.message);
		},

		async loadChecklists() {
			const sb = await client();
			const data = rows(
				await sb.from('checklists').select('route_id, date, checked_ids, updated_at')
			);
			return parseRows(data, checklistRow, 'checklists').map((r) => ({
				id: `${r.route_id}|${r.date}`,
				route_id: r.route_id,
				date: r.date,
				checked_ids: r.checked_ids,
				updated_at: r.updated_at
			}));
		},
		async upsertChecklists(records: ChecklistRecord[]) {
			const sb = await client();
			const uid = await userId(sb);
			const { error } = await sb.from('checklists').upsert(
				records.map((r) => ({
					user_id: uid,
					route_id: r.route_id,
					date: r.date,
					checked_ids: r.checked_ids,
					updated_at: r.updated_at
				})),
				{ onConflict: 'user_id,route_id,date' }
			);
			if (error) throw new Error(error.message);
		},

		async loadCustomGear() {
			const sb = await client();
			const data = rows(
				await sb
					.from('custom_gear')
					.select('id, name, category, weight_g, attributes, deleted, updated_at')
			);
			return parseRows(data, customGearRow, 'custom_gear').map((r) => ({
				id: r.id,
				name: r.name,
				category: r.category,
				weight_g: r.weight_g,
				attributes: r.attributes,
				updated_at: r.updated_at,
				...(r.deleted ? { deleted: true } : {})
			}));
		},
		async upsertCustomGear(records: CustomGearRecord[]) {
			const sb = await client();
			const uid = await userId(sb);
			const { error } = await sb.from('custom_gear').upsert(
				records.map((r) => ({
					id: r.id,
					user_id: uid,
					name: r.name,
					category: r.category,
					weight_g: r.weight_g,
					attributes: r.attributes,
					deleted: !!r.deleted,
					updated_at: r.updated_at
				})),
				{ onConflict: 'id' }
			);
			if (error) throw new Error(error.message);
		},

		async loadPreferences() {
			const sb = await client();
			const { data, error } = await sb.from('preferences').select('data, updated_at').maybeSingle();
			if (error) throw new Error(error.message);
			if (!data) return null;
			const parsed = preferencesRow.safeParse(data);
			if (!parsed.success) {
				console.warn('[sync] preferencias remotas inválidas, ignoradas:', parsed.error.issues);
				return null;
			}
			// El jsonb se normaliza a `Settings` en el límite (degradación elegante).
			return {
				updated_at: parsed.data.updated_at,
				data: coerceSettings(parsed.data.data)
			};
		},
		async upsertPreferences(record: PreferencesRecord) {
			const sb = await client();
			const uid = await userId(sb);
			const { error } = await sb.from('preferences').upsert(
				{ user_id: uid, data: record.data, updated_at: record.updated_at },
				{
					onConflict: 'user_id'
				}
			);
			if (error) throw new Error(error.message);
		}
	};
}
