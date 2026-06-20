/**
 * Fusión offline-first de datos de usuario (SPECS_V4 §A2). Núcleo puro y
 * testeable de la futura sincronización con la cuenta: combina el estado local
 * con el remoto sin perder cambios hechos en otro dispositivo.
 *
 * Estrategia: **last-write-wins por elemento** según `updated_at` (no por
 * documento entero), con tombstones (`deleted`) para propagar borrados. No toca
 * red ni Svelte; la capa de transporte (Supabase) la usará cuando se active el
 * backend (coste 0 hasta entonces).
 */

/** Registro sincronizable: id estable + marca de tiempo lógica + borrado. */
export interface Syncable {
	id: string;
	/** ISO 8601 del último cambio (reloj lógico para LWW). */
	updated_at: string;
	/** true = borrado (tombstone): se propaga pero no se muestra. */
	deleted?: boolean;
}

export interface MergeResult<T extends Syncable> {
	/** Estado fusionado, incluidos tombstones (para volver a sincronizar). */
	merged: T[];
	/** Registros locales que el remoto no tiene al día: hay que SUBIRLOS. */
	toPush: T[];
	/** Registros remotos más nuevos: hay que APLICARLOS en local. */
	toApply: T[];
}

/** ¿`a` es más reciente que `b`? Empate → false (se prefiere lo ya presente). */
function isNewer(a: Syncable, b: Syncable): boolean {
	return a.updated_at > b.updated_at;
}

/**
 * Fusiona dos colecciones por `id` (LWW por `updated_at`). Devuelve el estado
 * fusionado y las operaciones a propagar en cada sentido.
 */
export function mergeCollections<T extends Syncable>(local: T[], remote: T[]): MergeResult<T> {
	const localById = new Map(local.map((r) => [r.id, r]));
	const remoteById = new Map(remote.map((r) => [r.id, r]));
	const ids = new Set([...localById.keys(), ...remoteById.keys()]);

	const merged: T[] = [];
	const toPush: T[] = [];
	const toApply: T[] = [];

	for (const id of ids) {
		const l = localById.get(id);
		const r = remoteById.get(id);
		if (l && !r) {
			merged.push(l);
			toPush.push(l);
		} else if (r && !l) {
			merged.push(r);
			toApply.push(r);
		} else if (l && r) {
			if (isNewer(l, r)) {
				merged.push(l);
				toPush.push(l);
			} else if (isNewer(r, l)) {
				merged.push(r);
				toApply.push(r);
			} else {
				merged.push(r); // empate: estado ya consistente, sin operación
			}
		}
	}
	return { merged, toPush, toApply };
}

/** Registros vivos (sin tombstones), para mostrar en la UI. */
export function liveRecords<T extends Syncable>(records: T[]): T[] {
	return records.filter((r) => !r.deleted);
}

/**
 * Fusión de un valor único por usuario (preferencias, perfil): gana el de
 * `updated_at` mayor. `null` = ausente. Empate → remoto (estado de referencia).
 */
export function mergeSingleton<T extends { updated_at: string }>(
	local: T | null,
	remote: T | null
): { merged: T | null; push: boolean; apply: boolean } {
	if (local && !remote) return { merged: local, push: true, apply: false };
	if (remote && !local) return { merged: remote, push: false, apply: true };
	if (local && remote) {
		if (local.updated_at > remote.updated_at) return { merged: local, push: true, apply: false };
		if (remote.updated_at > local.updated_at) return { merged: remote, push: false, apply: true };
		return { merged: remote, push: false, apply: false };
	}
	return { merged: null, push: false, apply: false };
}
