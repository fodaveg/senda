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
	/**
	 * ISO 8601 del último cambio de los ajustes (SPECS_V4 §A2). Es un singleton
	 * sincronizable: la fusión usa `mergeSingleton` (LWW). Se backfillea a una
	 * fecha cero al cargar ajustes antiguos para que cualquier cambio explícito o
	 * el dato remoto real prevalezca.
	 */
	updated_at: string;
	theme: Theme;
	/** Esquema de color para modo claro y para modo oscuro (SPECS_V3 §9);
	 * ver src/lib/theme/schemes.ts. El toggle de modo aplica el que toque. */
	schemeLight: string;
	schemeDark: string;
	/** Escala del tamaño de texto (SPECS_V3.5 §7); 1 = normal. */
	textScale: number;
	/** Peso del usuario en kg (opcional, para estimar calorías; SPECS_V3.5 §1). */
	weightKg: number | null;
	aemetApiKey: string;
	vaultDir: string;
	/** Muestra los detalles técnicos en crudo cuando algo falla. */
	debugMode: boolean;
	/**
	 * Consentimiento (opt-in, RGPD) para enviar analítica **anónima** al backend
	 * (SPECS_V4 §B3/§11). Por defecto **desactivado**: no se recopila nada hasta
	 * que el usuario lo active explícitamente. Sin sesión, no se envía nunca.
	 */
	analyticsOptIn: boolean;
	/** Origen habitual para el tiempo de viaje (SPECS_V2 §6). */
	origin: OriginSetting | null;
	emergency: EmergencySettings;
}

const STORAGE_KEY = 'senderos-cv:settings';

/** Fecha cero para ajustes sin `updated_at` previo (cualquier dato real gana). */
const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_EMERGENCY: EmergencySettings = {
	name: '',
	phone: '',
	medical: '',
	vehicle: '',
	clothing: '',
	alarmMarginMin: 120
};

export const DEFAULT_SETTINGS: Settings = {
	updated_at: EPOCH,
	theme: 'auto',
	schemeLight: 'bosque-claro',
	schemeDark: 'bosque-oscuro',
	textScale: 1,
	weightKg: null,
	aemetApiKey: '',
	vaultDir: '',
	debugMode: false,
	analyticsOptIn: false,
	origin: null,
	emergency: { ...DEFAULT_EMERGENCY }
};

/**
 * Normaliza un objeto crudo a `Settings` válidos, campo a campo (tolerante: lo
 * desconocido cae a su valor por defecto). Es la validación de límite tanto de
 * localStorage como de lo que baja del backend (preferencias sincronizadas).
 */
export function coerceSettings(raw: unknown): Settings {
	const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
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
		updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : EPOCH,
		theme:
			parsed.theme === 'claro' || parsed.theme === 'oscuro' || parsed.theme === 'auto'
				? parsed.theme
				: 'auto',
		schemeLight: typeof parsed.schemeLight === 'string' ? parsed.schemeLight : 'bosque-claro',
		schemeDark: typeof parsed.schemeDark === 'string' ? parsed.schemeDark : 'bosque-oscuro',
		textScale:
			typeof parsed.textScale === 'number' && parsed.textScale >= 0.8 && parsed.textScale <= 1.6
				? parsed.textScale
				: 1,
		weightKg: typeof parsed.weightKg === 'number' && parsed.weightKg > 0 ? parsed.weightKg : null,
		aemetApiKey: typeof parsed.aemetApiKey === 'string' ? parsed.aemetApiKey : '',
		vaultDir: typeof parsed.vaultDir === 'string' ? parsed.vaultDir : '',
		debugMode: parsed.debugMode === true,
		analyticsOptIn: parsed.analyticsOptIn === true,
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
}

export function loadSettings(): Settings {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		return coerceSettings(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

/**
 * Persiste los ajustes **verbatim** (sin tocar `updated_at`). El sellado de la
 * marca de tiempo vive en la capa de repositorio (un guardado del usuario sella
 * `updated_at`; aplicar un resultado de fusión remoto NO debe re-sellarlo, o el
 * LWW quedaría siempre ganado por el local). Ver `stampSettings`.
 */
export function saveSettings(settings: Settings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Devuelve una copia con `updated_at` = ahora (cambio iniciado por el usuario). */
export function stampSettings(settings: Settings): Settings {
	return { ...settings, updated_at: new Date().toISOString() };
}

/** ¿El sistema prefiere modo oscuro? (para resolver el tema "auto"). */
export function prefersDark(): boolean {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Aplica la escala de texto al documento (SPECS_V3.5 §7). Fija tanto el
 * `font-size` raíz (para la UI basada en `rem`) como la variable `--scale` que
 * usan los tokens tipográficos del sistema de diseño v6 (`calc(px * --scale)`),
 * de modo que ambos mecanismos escalan por igual sin doble escalado. */
export function applyTextScale(scale: number): void {
	if (typeof document === 'undefined') return;
	document.documentElement.style.fontSize = scale === 1 ? '' : `${Math.round(scale * 100)}%`;
	document.documentElement.style.setProperty('--scale', String(scale));
}

/** Aplica el tema al documento ("claro" fuerza modo claro para sol directo). */
export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = theme === 'claro' ? 'claro' : theme;
}
