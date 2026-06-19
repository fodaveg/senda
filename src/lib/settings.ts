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

/** Datos opcionales para la ficha de emergencia (SPECS_V2 §9). Solo
 * localStorage; únicamente se incluyen en el documento que el usuario
 * genera y comparte. */
export interface EmergencySettings {
	name: string;
	phone: string;
	medical: string;
	vehicle: string;
	clothing: string;
	/** Margen tras el fin estimado para la hora límite de alarma (min). */
	alarmMarginMin: number;
}

export type Theme = 'auto' | 'claro' | 'oscuro';

export interface Settings {
	theme: Theme;
	/** Id de la paleta de color (SPECS_V3 §9); ver src/lib/theme/palettes.ts. */
	palette: string;
	aemetApiKey: string;
	vaultDir: string;
	/** Muestra los detalles técnicos en crudo cuando algo falla. */
	debugMode: boolean;
	/** Origen habitual para el tiempo de viaje (SPECS_V2 §6). */
	origin: OriginSetting | null;
	emergency: EmergencySettings;
}

const STORAGE_KEY = 'senderos-cv:settings';

export const DEFAULT_EMERGENCY: EmergencySettings = {
	name: '',
	phone: '',
	medical: '',
	vehicle: '',
	clothing: '',
	alarmMarginMin: 120
};

export const DEFAULT_SETTINGS: Settings = {
	theme: 'auto',
	palette: 'bosque',
	aemetApiKey: '',
	vaultDir: '',
	debugMode: false,
	origin: null,
	emergency: { ...DEFAULT_EMERGENCY }
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
		const e = (parsed.emergency ?? {}) as Partial<EmergencySettings>;
		const str = (v: unknown) => (typeof v === 'string' ? v : '');
		return {
			theme:
				parsed.theme === 'claro' || parsed.theme === 'oscuro' || parsed.theme === 'auto'
					? parsed.theme
					: 'auto',
			palette: typeof parsed.palette === 'string' ? parsed.palette : 'bosque',
			aemetApiKey: typeof parsed.aemetApiKey === 'string' ? parsed.aemetApiKey : '',
			vaultDir: typeof parsed.vaultDir === 'string' ? parsed.vaultDir : '',
			debugMode: parsed.debugMode === true,
			origin: validOrigin,
			emergency: {
				name: str(e.name),
				phone: str(e.phone),
				medical: str(e.medical),
				vehicle: str(e.vehicle),
				clothing: str(e.clothing),
				alarmMarginMin:
					typeof e.alarmMarginMin === 'number' && e.alarmMarginMin > 0 ? e.alarmMarginMin : 120
			}
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings: Settings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Aplica el tema al documento ("claro" fuerza modo claro para sol directo). */
export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = theme === 'claro' ? 'claro' : theme;
}
