/**
 * Repositorio de datos de usuario (SPECS_V4 §A1). Abstracción única sobre todo
 * el estado del usuario (marcas/diario, checklist, material custom y
 * ajustes/apariencia) para poder sincronizarlo con la cuenta sin tocar cada
 * componente.
 *
 * Hoy solo existe `LocalRepository` (localStorage, idéntico a v3); en la v4 se
 * añadirá `SyncedRepository` (local + remoto) detrás de **esta misma interfaz**.
 * Por eso `load`/`save` son **síncronos**: la lectura siempre devuelve el estado
 * local al instante (offline-first); la futura sincronización remota ocurre en
 * segundo plano y avisa por `subscribe`. La UI nunca espera a la red.
 *
 * Las funciones de mutación puras (`withToggledMark`, `addCustomItem`, …) siguen
 * en sus módulos; el repositorio solo se encarga de persistir y notificar.
 */

import type { UserData } from './marks';
import type { CustomGearData } from './customGear';
import type { Settings } from '$lib/settings';

export interface UserDataRepository {
	// — Marcas y diario de salidas (marks.ts) —
	loadMarks(): UserData;
	saveMarks(data: UserData): void;

	// — Checklist de mochila por (ruta, fecha) (checklist.ts) —
	loadChecklist(routeId: string, date: string): Set<string>;
	saveChecklist(routeId: string, date: string, checked: Set<string>): void;

	// — Material custom (customGear.ts) —
	loadCustomGear(): CustomGearData;
	saveCustomGear(data: CustomGearData): void;

	// — Ajustes y apariencia (settings.ts) —
	loadSettings(): Settings;
	saveSettings(settings: Settings): void;

	/**
	 * Notifica cuando los datos cambian por una vía externa al lector actual:
	 * otra pestaña (evento `storage`) hoy, una sincronización remota mañana.
	 * Devuelve la función para cancelar la suscripción.
	 */
	subscribe(listener: () => void): () => void;
}
