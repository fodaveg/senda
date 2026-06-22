/**
 * Checklist de mochila por (ruta, fecha de salida) (SPECS_V2 §7):
 * qué ítems están ya en la mochila. localStorage con esquema versionado.
 * Las decisiones del motor no cambian; esto solo registra la preparación.
 *
 * **v2 (SPECS_V4 §A2 — sincronizable):** cada entrada `(ruta, fecha)` lleva
 * `updated_at` (LWW). Vaciar la lista guarda una entrada con `items: []` (en vez
 * de borrar la clave) para que el "desmarcado" también se propague entre
 * dispositivos. La migración v1→v2 backfillea `updated_at` sin perder datos.
 */

import { nowIso } from './sync/clock';

const STORAGE_KEY = 'senderos-cv:checklist';
const SCHEMA = 2;

/** Una entrada por clave `(ruta, fecha)`: ítems marcados + marca de tiempo. */
interface ChecklistEntry {
	items: string[];
	updated_at: string;
}

interface ChecklistData {
	schema: number;
	/** "<routeId>|<YYYY-MM-DD>" → entrada con ítems y `updated_at`. */
	checks: Record<string, ChecklistEntry>;
}

function emptyData(): ChecklistData {
	return { schema: SCHEMA, checks: {} };
}

/**
 * Lee y, si hace falta, migra el almacén. v1 guardaba `checks` como
 * `Record<key, string[]>`; se migra a entradas `{ items, updated_at }`.
 */
function loadData(): ChecklistData {
	if (typeof localStorage === 'undefined') return emptyData();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyData();
		const parsed = JSON.parse(raw) as Partial<ChecklistData> & {
			checks?: Record<string, unknown>;
		};
		if (typeof parsed.checks !== 'object' || !parsed.checks) return emptyData();
		const now = nowIso();
		const checks: Record<string, ChecklistEntry> = {};
		for (const [key, value] of Object.entries(parsed.checks)) {
			if (Array.isArray(value)) {
				// v1: solo el array de ítems → backfill de updated_at.
				checks[key] = {
					items: value.filter((x): x is string => typeof x === 'string'),
					updated_at: now
				};
			} else if (
				value &&
				typeof value === 'object' &&
				Array.isArray((value as ChecklistEntry).items)
			) {
				const e = value as ChecklistEntry;
				checks[key] = {
					items: e.items.filter((x): x is string => typeof x === 'string'),
					updated_at: typeof e.updated_at === 'string' ? e.updated_at : now
				};
			}
		}
		return { schema: SCHEMA, checks };
	} catch {
		return emptyData();
	}
}

function keyOf(routeId: string, date: string): string {
	return `${routeId}|${date}`;
}

export function loadChecklist(routeId: string, date: string): Set<string> {
	return new Set(loadData().checks[keyOf(routeId, date)]?.items ?? []);
}

export function saveChecklist(routeId: string, date: string, checked: Set<string>): void {
	if (typeof localStorage === 'undefined') return;
	const data = loadData();
	const key = keyOf(routeId, date);
	// Se guarda también la lista vacía (con `updated_at`) para que el desmarcado
	// se propague en la sincronización, en vez de borrar la clave silenciosamente.
	data.checks[key] = { items: [...checked].sort(), updated_at: nowIso() };
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
