/**
 * Paletas de color curadas (SPECS_V3 §9). Cada paleta define su color de
 * acento (`--brand`) y el del encabezado (`--brand-strong`) en dos tonos
 * —claro y oscuro—. Se aplican con la función CSS `light-dark()`, de modo que
 * una sola fuente de verdad (este módulo) sirve para el tema claro, el oscuro
 * y el automático: el valor se resuelve según el `color-scheme` que ya fija el
 * tema en `:root`. No rompe el "claro forzado" para sol directo.
 *
 * Módulo puro salvo `applyPalette`, que solo toca el documento.
 */

export interface Palette {
	id: string;
	name: string;
	/** Acento [claro, oscuro]. */
	accent: [string, string];
	/** Fondo del encabezado [claro, oscuro] (texto siempre claro encima). */
	header: [string, string];
}

export const DEFAULT_PALETTE_ID = 'bosque';

export const PALETTES: Palette[] = [
	{ id: 'bosque', name: 'Bosque', accent: ['#1d3a2a', '#8fd3ae'], header: ['#1d3a2a', '#18241d'] },
	{ id: 'mar', name: 'Mar', accent: ['#1b4965', '#7fb5d6'], header: ['#1b4965', '#13303f'] },
	{
		id: 'atardecer',
		name: 'Atardecer',
		accent: ['#a8430f', '#f0a878'],
		header: ['#8a3a10', '#341606']
	},
	{
		id: 'piedra',
		name: 'Piedra (alto contraste)',
		accent: ['#3a3a3a', '#cfcfcf'],
		header: ['#2b2b2b', '#1c1c1c']
	}
];

/** Paleta por id; cae a la por defecto si el id no existe. */
export function getPalette(id: string): Palette {
	return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID)!;
}

/** Aplica la paleta fijando los tokens de color en el documento. */
export function applyPalette(id: string): void {
	if (typeof document === 'undefined') return;
	const palette = getPalette(id);
	const root = document.documentElement.style;
	root.setProperty('--brand', `light-dark(${palette.accent[0]}, ${palette.accent[1]})`);
	root.setProperty('--brand-strong', `light-dark(${palette.header[0]}, ${palette.header[1]})`);
}
