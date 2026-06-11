/**
 * Checklist de mochila por (ruta, fecha de salida) (SPECS_V2 §7):
 * qué ítems están ya en la mochila. localStorage con esquema versionado.
 * Las decisiones del motor no cambian; esto solo registra la preparación.
 */

const STORAGE_KEY = 'senderos-cv:checklist';
const SCHEMA = 1;

interface ChecklistData {
	schema: number;
	/** "<routeId>|<YYYY-MM-DD>" → ids de ítems marcados. */
	checks: Record<string, string[]>;
}

function emptyData(): ChecklistData {
	return { schema: SCHEMA, checks: {} };
}

function loadData(): ChecklistData {
	if (typeof localStorage === 'undefined') return emptyData();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyData();
		const parsed = JSON.parse(raw) as Partial<ChecklistData>;
		if (parsed.schema !== SCHEMA || typeof parsed.checks !== 'object' || !parsed.checks) {
			return emptyData();
		}
		return { schema: SCHEMA, checks: parsed.checks };
	} catch {
		return emptyData();
	}
}

function keyOf(routeId: string, date: string): string {
	return `${routeId}|${date}`;
}

export function loadChecklist(routeId: string, date: string): Set<string> {
	return new Set(loadData().checks[keyOf(routeId, date)] ?? []);
}

export function saveChecklist(routeId: string, date: string, checked: Set<string>): void {
	if (typeof localStorage === 'undefined') return;
	const data = loadData();
	const key = keyOf(routeId, date);
	if (checked.size === 0) {
		delete data.checks[key];
	} else {
		data.checks[key] = [...checked].sort();
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
