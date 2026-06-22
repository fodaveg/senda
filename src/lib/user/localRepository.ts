/**
 * Implementación localStorage del repositorio de datos de usuario
 * (SPECS_V4 §A1). Es el comportamiento de v3 detrás de la nueva interfaz: cada
 * operación delega en las funciones de persistencia ya existentes de cada
 * módulo. No añade lógica nueva; solo centraliza el acceso para que la futura
 * `SyncedRepository` pueda reemplazarla sin tocar los componentes.
 *
 * `subscribe` escucha el evento `storage` del navegador: así una pestaña se
 * entera de los cambios que hace otra (mismo origen). Es también el gancho que
 * usará la sincronización remota para refrescar la UI al aplicar cambios.
 */

import { loadUserData, saveUserData, type UserData } from './marks';
import {
	loadChecklist as loadChecklistData,
	saveChecklist as saveChecklistData
} from './checklist';
import { loadCustomGear, saveCustomGear, type CustomGearData } from './customGear';
import { loadSettings, saveSettings, stampSettings, type Settings } from '$lib/settings';
import type { UserDataRepository } from './repository';

/** Prefijo común de todas las claves de usuario en localStorage. */
const KEY_PREFIX = 'senderos-cv:';

export class LocalRepository implements UserDataRepository {
	#listeners = new Set<() => void>();
	#onStorage?: (e: StorageEvent) => void;

	constructor() {
		// Cambios hechos en otra pestaña del mismo origen (el evento `storage` no
		// se dispara en la pestaña que escribe, solo en las demás).
		if (typeof window !== 'undefined') {
			this.#onStorage = (e: StorageEvent) => {
				if (!e.key || e.key.startsWith(KEY_PREFIX)) this.#notify();
			};
			window.addEventListener('storage', this.#onStorage);
		}
	}

	loadMarks(): UserData {
		return loadUserData();
	}
	saveMarks(data: UserData): void {
		saveUserData(data);
		this.#notify();
	}

	loadChecklist(routeId: string, date: string): Set<string> {
		return loadChecklistData(routeId, date);
	}
	saveChecklist(routeId: string, date: string, checked: Set<string>): void {
		saveChecklistData(routeId, date, checked);
		this.#notify();
	}

	loadCustomGear(): CustomGearData {
		return loadCustomGear();
	}
	saveCustomGear(data: CustomGearData): void {
		saveCustomGear(data);
		this.#notify();
	}

	loadSettings(): Settings {
		return loadSettings();
	}
	saveSettings(settings: Settings): void {
		// Un guardado del usuario sella `updated_at` (singleton sincronizable).
		saveSettings(stampSettings(settings));
		this.#notify();
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Libera el listener de `storage` (para entornos que recrean el repo). */
	dispose(): void {
		if (this.#onStorage && typeof window !== 'undefined') {
			window.removeEventListener('storage', this.#onStorage);
			this.#onStorage = undefined;
		}
		this.#listeners.clear();
	}

	#notify(): void {
		for (const listener of this.#listeners) listener();
	}
}
