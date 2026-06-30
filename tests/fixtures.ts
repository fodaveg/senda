/**
 * Base de los e2e: `test`/`expect` con la ficha en disposición **Tablero**.
 *
 * El rediseño v6 introdujo en la ficha un switch Pestañas ⇄ Tablero; en
 * "Pestañas" (defecto) solo la sección activa es visible (las demás quedan con
 * `display:none`), lo que rompería las aserciones de contenido fuera de Resumen
 * (perfil, mochila, meteo, etc.). "Tablero" muestra todas las secciones a la vez
 * en escritorio (≥721px, como el viewport por defecto de Playwright) y equivale
 * al scroll largo previo a las pestañas, así que es la vista natural para probar
 * el contenido de cada módulo.
 *
 * La preferencia vive en localStorage (clave de `$lib/ficha/layoutPref`); se fija
 * con `addInitScript` para que la app la lea ya en el primer render.
 */
import { test as base, expect } from '@playwright/test';

// Espejo de STORAGE_KEY en src/lib/ficha/layoutPref.ts (los init scripts corren
// en el navegador y no pueden importar código de la app).
const FICHA_LAYOUT_KEY = 'senderoscv:ficha-layout';

export const test = base.extend({
	page: async ({ page }, use) => {
		await page.addInitScript((key) => {
			try {
				localStorage.setItem(key, 'board');
			} catch {
				// Solo es una preferencia de UI; si falla, el test usará 'tabs'.
			}
		}, FICHA_LAYOUT_KEY);
		await use(page);
	}
});

export { expect };
