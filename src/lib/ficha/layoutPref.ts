/**
 * Disposición preferida de la ficha de ruta (handoff v6): la persona elige
 * entre dos vistas y se recuerda entre visitas.
 * - `tabs` (defecto): pestañas; solo la sección activa visible.
 * - `board`: tablero modular (índice lateral + secciones apiladas) en escritorio.
 *
 * localStorage propio (como las prefs del mapa), fuera del esquema versionado de
 * ajustes: es solo una preferencia de UI, no un dato de usuario. Puro salvo el
 * acceso a localStorage.
 */

export type FichaLayout = 'tabs' | 'board';

const STORAGE_KEY = 'senderoscv:ficha-layout';
const DEFAULT: FichaLayout = 'tabs';

export function loadFichaLayout(): FichaLayout {
	if (typeof localStorage === 'undefined') return DEFAULT;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw === 'tabs' || raw === 'board' ? raw : DEFAULT;
	} catch {
		return DEFAULT;
	}
}

export function saveFichaLayout(layout: FichaLayout): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, layout);
	} catch {
		// Solo es una preferencia; si falla, no pasa nada.
	}
}
