/**
 * Contrato del almacén remoto de datos de usuario (SPECS_V4 §B2). Una operación
 * de **carga** y otra de **upsert** por dominio; la implementación real
 * (Supabase, ver `supabaseRemote.ts`) queda detrás de esta interfaz para
 * mantener la portabilidad (Cloud ↔ self-host) y para poder **mockearla** en los
 * tests sin tocar el backend.
 *
 * Las colecciones son de registros sincronizables (`records.ts`); el `user_id`
 * lo inyecta la implementación desde la sesión autenticada (RLS lo exige). El
 * upsert recibe únicamente los registros a empujar (los "más nuevos" en local).
 */

import type {
	ChecklistRecord,
	CustomGearRecord,
	OutingRecord,
	PreferencesRecord,
	RouteMarkRecord
} from './records';

export interface RemoteStore {
	loadRouteMarks(): Promise<RouteMarkRecord[]>;
	upsertRouteMarks(records: RouteMarkRecord[]): Promise<void>;

	loadOutings(): Promise<OutingRecord[]>;
	upsertOutings(records: OutingRecord[]): Promise<void>;

	loadChecklists(): Promise<ChecklistRecord[]>;
	upsertChecklists(records: ChecklistRecord[]): Promise<void>;

	loadCustomGear(): Promise<CustomGearRecord[]>;
	upsertCustomGear(records: CustomGearRecord[]): Promise<void>;

	/** Singleton de preferencias del usuario; `null` si aún no hay fila. */
	loadPreferences(): Promise<PreferencesRecord | null>;
	upsertPreferences(record: PreferencesRecord): Promise<void>;
}
