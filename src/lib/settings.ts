/**
 * Ajustes locales del usuario (localStorage): api key de AEMET (opcional)
 * y carpeta del vault para guardar informes en Tauri.
 */

export interface Settings {
	aemetApiKey: string;
	vaultDir: string;
	/** Muestra los detalles técnicos en crudo cuando algo falla. */
	debugMode: boolean;
}

const STORAGE_KEY = 'senderos-cv:settings';

export const DEFAULT_SETTINGS: Settings = { aemetApiKey: '', vaultDir: '', debugMode: false };

export function loadSettings(): Settings {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<Settings>;
		return {
			aemetApiKey: typeof parsed.aemetApiKey === 'string' ? parsed.aemetApiKey : '',
			vaultDir: typeof parsed.vaultDir === 'string' ? parsed.vaultDir : '',
			debugMode: parsed.debugMode === true
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings: Settings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
