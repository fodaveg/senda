/**
 * Preferencias de descubrimiento que se recuerdan entre visitas (pulido v3): el
 * "origen del filtro" geográfico, es decir la **provincia** y la **comarca**
 * seleccionadas en la home. Así, al volver, el listado arranca donde el usuario
 * lo dejó en vez de reiniciarse. localStorage, un único almacén, tolerante a
 * datos corruptos (es solo una preferencia). Puro salvo el acceso a localStorage.
 */

import type { Province } from '$lib/geo/province';

const STORAGE_KEY = 'senderoscv:discover-prefs';

export interface DiscoverPrefs {
	/** Provincia derivada de la comarca; null = todas. */
	province: Province | null;
	/** Comarca/zona; null = todas. */
	zone: string | null;
}

const DEFAULTS: DiscoverPrefs = { province: null, zone: null };

const PROVINCES: Province[] = ['castellon', 'valencia', 'alicante'];

export function loadDiscoverPrefs(): DiscoverPrefs {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw) as Partial<DiscoverPrefs>;
		return {
			province:
				typeof parsed.province === 'string' && PROVINCES.includes(parsed.province)
					? parsed.province
					: null,
			zone: typeof parsed.zone === 'string' && parsed.zone ? parsed.zone : null
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveDiscoverPrefs(prefs: DiscoverPrefs): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Solo es una preferencia; si falla, no pasa nada.
	}
}
