/**
 * Preferencias del mapa que se recuerdan entre visitas (SPECS_V3 pulido §3):
 * capa base elegida y visibilidad de las capas de datos (agua, POIs).
 * localStorage, un único almacén; cada escritor hace load→modificar→save para
 * no pisar el resto. Puro salvo el acceso a localStorage (guardado).
 */

import { DEFAULT_LAYER_ID } from './layers';

const STORAGE_KEY = 'senderoscv:map-prefs';

export interface MapPrefs {
	layer: string;
	showWater: boolean;
	showPois: boolean;
}

const DEFAULTS: MapPrefs = { layer: DEFAULT_LAYER_ID, showWater: true, showPois: true };

export function loadMapPrefs(): MapPrefs {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw) as Partial<MapPrefs>;
		return {
			layer: typeof parsed.layer === 'string' ? parsed.layer : DEFAULTS.layer,
			showWater: typeof parsed.showWater === 'boolean' ? parsed.showWater : DEFAULTS.showWater,
			showPois: typeof parsed.showPois === 'boolean' ? parsed.showPois : DEFAULTS.showPois
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveMapPrefs(prefs: MapPrefs): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Solo es una preferencia; si falla, no pasa nada.
	}
}
