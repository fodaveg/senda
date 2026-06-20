/**
 * Esquemas de color de la app (SPECS_V3 §9, rediseño). A diferencia de las
 * paletas iniciales (solo acento), cada esquema define el **set completo de
 * tokens** de color y se aplica a toda la app. Hay esquemas separados por
 * **modo**: el usuario elige uno para claro y otro para oscuro, y el toggle de
 * modo activa el que corresponda (modelo tipo panel de WordPress).
 *
 * Módulo con datos puros + `applyScheme`/`applyAppearance` (único efecto: fijar
 * variables CSS en el documento). La parte de selección es testeable sin DOM.
 */

import { prefersDark, type Settings, type Theme } from '$lib/settings';

export type SchemeMode = 'claro' | 'oscuro';

/** Todos los tokens de color que consume la UI. */
export interface SchemeTokens {
	bg: string;
	surface: string;
	surfaceAlt: string;
	border: string;
	ink: string;
	muted: string;
	mutedStrong: string;
	brand: string;
	brandStrong: string;
	/** Texto sobre fondos de acento (botones): contraste garantizado. */
	onBrand: string;
	alertBg: string;
	alertBorder: string;
	alertInk: string;
}

export interface ColorScheme {
	id: string;
	name: string;
	mode: SchemeMode;
	tokens: SchemeTokens;
	/** Colores representativos para la previsualización (cajitas). */
	swatches: string[];
}

export const DEFAULT_LIGHT_SCHEME = 'bosque-claro';
export const DEFAULT_DARK_SCHEME = 'bosque-oscuro';

export const LIGHT_SCHEMES: ColorScheme[] = [
	{
		id: 'bosque-claro',
		name: 'Bosque',
		mode: 'claro',
		tokens: {
			bg: '#fbfaf7',
			surface: '#ffffff',
			surfaceAlt: '#f4f2ec',
			border: '#d8d4c8',
			ink: '#1a1a1a',
			muted: '#555555',
			mutedStrong: '#3a3a3a',
			brand: '#1d3a2a',
			brandStrong: '#1d3a2a',
			onBrand: '#ffffff',
			alertBg: '#fdecea',
			alertBorder: '#b3261e',
			alertInk: '#7a1c16'
		},
		swatches: ['#1d3a2a', '#fbfaf7', '#ffffff', '#b3261e']
	},
	{
		id: 'mar-claro',
		name: 'Mar',
		mode: 'claro',
		tokens: {
			bg: '#f5f8fb',
			surface: '#ffffff',
			surfaceAlt: '#e8eef4',
			border: '#c9d6e2',
			ink: '#16242f',
			muted: '#4a5b68',
			mutedStrong: '#2c3a45',
			brand: '#1b4965',
			brandStrong: '#143041',
			onBrand: '#ffffff',
			alertBg: '#fff3e0',
			alertBorder: '#b35900',
			alertInk: '#7a3c00'
		},
		swatches: ['#1b4965', '#5fa8d3', '#f5f8fb', '#b35900']
	},
	{
		id: 'atardecer-claro',
		name: 'Atardecer',
		mode: 'claro',
		tokens: {
			bg: '#fef8f3',
			surface: '#ffffff',
			surfaceAlt: '#f6e9df',
			border: '#e4cdbb',
			ink: '#3a1c0c',
			muted: '#6b4a36',
			mutedStrong: '#4a2f1c',
			brand: '#a8430f',
			brandStrong: '#8a3a10',
			onBrand: '#ffffff',
			alertBg: '#fdecea',
			alertBorder: '#b3261e',
			alertInk: '#7a1c16'
		},
		swatches: ['#a8430f', '#f0a878', '#fef8f3', '#3a1c0c']
	},
	{
		id: 'alto-contraste-sol',
		name: 'Alto contraste (sol)',
		mode: 'claro',
		tokens: {
			bg: '#ffffff',
			surface: '#ffffff',
			surfaceAlt: '#ededed',
			border: '#7a7a7a',
			ink: '#000000',
			muted: '#2e2e2e',
			mutedStrong: '#111111',
			brand: '#0b3d2e',
			brandStrong: '#0b3d2e',
			onBrand: '#ffffff',
			alertBg: '#ffe8e8',
			alertBorder: '#a80000',
			alertInk: '#5e0000'
		},
		swatches: ['#000000', '#ffffff', '#0b3d2e', '#a80000']
	}
];

export const DARK_SCHEMES: ColorScheme[] = [
	{
		id: 'bosque-oscuro',
		name: 'Bosque',
		mode: 'oscuro',
		tokens: {
			bg: '#141815',
			surface: '#1e2420',
			surfaceAlt: '#262d28',
			border: '#3a423b',
			ink: '#e8e6df',
			muted: '#a9aea5',
			mutedStrong: '#c3c8be',
			brand: '#8fd3ae',
			brandStrong: '#18241d',
			onBrand: '#0c1a12',
			alertBg: '#3a1f1c',
			alertBorder: '#f08a82',
			alertInk: '#ffd9d5'
		},
		swatches: ['#8fd3ae', '#141815', '#1e2420', '#f08a82']
	},
	{
		id: 'noche-azul',
		name: 'Noche azul',
		mode: 'oscuro',
		tokens: {
			bg: '#0f1722',
			surface: '#182433',
			surfaceAlt: '#20303f',
			border: '#324456',
			ink: '#e4ecf3',
			muted: '#9fb1c2',
			mutedStrong: '#c2d0dc',
			brand: '#7fb5d6',
			brandStrong: '#122334',
			onBrand: '#08131d',
			alertBg: '#3a2a18',
			alertBorder: '#f0b878',
			alertInk: '#ffe8c9'
		},
		swatches: ['#7fb5d6', '#0f1722', '#182433', '#f0b878']
	},
	{
		id: 'carbon',
		name: 'Carbón',
		mode: 'oscuro',
		tokens: {
			bg: '#121212',
			surface: '#1e1e1e',
			surfaceAlt: '#2a2a2a',
			border: '#474747',
			ink: '#f2f2f2',
			muted: '#b0b0b0',
			mutedStrong: '#d6d6d6',
			brand: '#cfcfcf',
			brandStrong: '#1a1a1a',
			onBrand: '#111111',
			alertBg: '#3a2222',
			alertBorder: '#f08a82',
			alertInk: '#ffd9d5'
		},
		swatches: ['#cfcfcf', '#121212', '#1e1e1e', '#f08a82']
	},
	{
		id: 'ambar-nocturno',
		name: 'Ámbar nocturno',
		mode: 'oscuro',
		tokens: {
			bg: '#1a140d',
			surface: '#241c12',
			surfaceAlt: '#2f2517',
			border: '#463827',
			ink: '#f0e7d8',
			muted: '#b9a98f',
			mutedStrong: '#d4c4a6',
			brand: '#f0a878',
			brandStrong: '#2a1c0c',
			onBrand: '#1a0e04',
			alertBg: '#3a2418',
			alertBorder: '#f0b878',
			alertInk: '#ffe8c9'
		},
		swatches: ['#f0a878', '#1a140d', '#241c12', '#f0b878']
	},
	{
		id: 'halloween',
		name: 'Halloween',
		mode: 'oscuro',
		tokens: {
			bg: '#160a1f',
			surface: '#221233',
			surfaceAlt: '#2e1944',
			border: '#4a2d63',
			ink: '#f3e9ff',
			muted: '#b99fd1',
			mutedStrong: '#d8c4ef',
			brand: '#ff7518',
			brandStrong: '#1a0d26',
			onBrand: '#1a0d04',
			alertBg: '#3a1f0a',
			alertBorder: '#ff9d4d',
			alertInk: '#ffe0c2'
		},
		swatches: ['#ff7518', '#7b2ff7', '#160a1f', '#f3e9ff']
	}
];

/** Esquema por id dentro de su modo; cae al por defecto del modo si no existe. */
export function getScheme(id: string, mode: SchemeMode): ColorScheme {
	const catalog = mode === 'oscuro' ? DARK_SCHEMES : LIGHT_SCHEMES;
	const fallbackId = mode === 'oscuro' ? DEFAULT_DARK_SCHEME : DEFAULT_LIGHT_SCHEME;
	return catalog.find((s) => s.id === id) ?? catalog.find((s) => s.id === fallbackId)!;
}

/** Modo efectivo a partir del ajuste de tema (resuelve "auto" con el sistema). */
export function effectiveMode(theme: Theme): SchemeMode {
	if (theme === 'oscuro') return 'oscuro';
	if (theme === 'claro') return 'claro';
	return prefersDark() ? 'oscuro' : 'claro';
}

/** Esquema activo según los ajustes y el modo efectivo. */
export function activeScheme(settings: Settings): ColorScheme {
	const mode = effectiveMode(settings.theme);
	return getScheme(mode === 'oscuro' ? settings.schemeDark : settings.schemeLight, mode);
}

const TOKEN_VARS: Array<[keyof SchemeTokens, string]> = [
	['bg', '--bg'],
	['surface', '--surface'],
	['surfaceAlt', '--surface-alt'],
	['border', '--border'],
	['ink', '--ink'],
	['muted', '--muted'],
	['mutedStrong', '--muted-strong'],
	['brand', '--brand'],
	['brandStrong', '--brand-strong'],
	['onBrand', '--on-brand'],
	['alertBg', '--alert-bg'],
	['alertBorder', '--alert-border'],
	['alertInk', '--alert-ink']
];

/** Fija los tokens del esquema como variables CSS en el documento. */
export function applyScheme(scheme: ColorScheme): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement.style;
	for (const [key, cssVar] of TOKEN_VARS) root.setProperty(cssVar, scheme.tokens[key]);
}

/**
 * Aplica el modo (data-theme para color-scheme) y el esquema activo. Es el
 * único punto que toca la apariencia; lo llaman el layout, el toggle y Ajustes.
 */
export function applyAppearance(settings: Settings): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = effectiveMode(settings.theme);
	applyScheme(activeScheme(settings));
}
