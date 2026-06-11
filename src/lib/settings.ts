/**
 * Ajustes locales del usuario (localStorage): api key de AEMET (opcional)
 * y carpeta del vault para guardar informes en Tauri.
 */

export interface OriginSetting {
	lat: number;
	lon: number;
	/** Etiqueta legible ("Casa", "Valencia"…). */
	label: string;
}

export interface Settings {
	aemetApiKey: string;
	vaultDir: string;
	/** Muestra los detalles técnicos en crudo cuando algo falla. */
	debugMode: boolean;
	/** Origen habitual para el tiempo de viaje (SPECS_V2 §6). */
	origin: OriginSetting | null;
}

const STORAGE_KEY = 'senderos-cv:settings';

export const DEFAULT_SETTINGS: Settings = {
	aemetApiKey: '',
	vaultDir: '',
	debugMode: false,
	origin: null
};

export function loadSettings(): Settings {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<Settings>;
		const origin = parsed.origin;
		const validOrigin =
			origin &&
			typeof origin === 'object' &&
			typeof origin.lat === 'number' &&
			origin.lat >= -90 &&
			origin.lat <= 90 &&
			typeof origin.lon === 'number' &&
			origin.lon >= -180 &&
			origin.lon <= 180 &&
			typeof origin.label === 'string'
				? { lat: origin.lat, lon: origin.lon, label: origin.label }
				: null;
		return {
			aemetApiKey: typeof parsed.aemetApiKey === 'string' ? parsed.aemetApiKey : '',
			vaultDir: typeof parsed.vaultDir === 'string' ? parsed.vaultDir : '',
			debugMode: parsed.debugMode === true,
			origin: validOrigin
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings: Settings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
