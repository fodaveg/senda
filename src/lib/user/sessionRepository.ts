/**
 * Repositorio "conmutable" según la sesión (SPECS_V4 §B2). Es la instancia que
 * el layout raíz provee por contexto; **una sola y estable**, de modo que los
 * componentes la obtienen una vez y siguen funcionando aunque por debajo cambie
 * el backend:
 *
 *  - **anónimo / sin backend** → delega en `LocalRepository` (idéntico a v3).
 *  - **autenticado** → delega en `SyncedRepository` (local + sincronización en
 *    segundo plano). Al activarse, `start()` hace una fusión no destructiva que
 *    **sube** los datos locales y **baja** los del resto de dispositivos (§A6: la
 *    fusión es automática, nunca se sobreescribe).
 *
 * Al conmutar, se reemiten las notificaciones para que la UI recargue, y se
 * libera el repositorio anterior. El estado de sincronización se expone para el
 * indicador.
 */

import { writable, type Readable } from 'svelte/store';
import type { UserData } from './marks';
import type { CustomGearData } from './customGear';
import type { Settings } from '$lib/settings';
import type { UserDataRepository } from './repository';
import { LocalRepository } from './localRepository';
import { SyncedRepository, type SyncStatus } from './syncedRepository';
import type { RemoteStore } from '$lib/sync/remote';

/** Estado del indicador: 'local' cuando no hay sesión (no se sincroniza). */
export type RepoSyncStatus = SyncStatus | 'local';

export class SwitchableRepository implements UserDataRepository {
	#inner: UserDataRepository = new LocalRepository();
	#synced: SyncedRepository | null = null;
	#listeners = new Set<() => void>();
	#unsubInner: (() => void) | null = null;
	#unsubStatus: (() => void) | null = null;
	#status = writable<RepoSyncStatus>('local');

	constructor() {
		this.#wireInner();
	}

	/** Estado de sincronización para el indicador de la UI. */
	get status(): Readable<RepoSyncStatus> {
		return { subscribe: this.#status.subscribe };
	}

	/**
	 * Activa la sincronización con la cuenta (al iniciar sesión). Idempotente: si
	 * ya hay un `SyncedRepository`, no hace nada. Lanza la primera sincronización
	 * (fusión local↔remoto) en segundo plano.
	 */
	useSynced(remote: RemoteStore): void {
		if (this.#synced) return;
		const synced = new SyncedRepository(remote);
		this.#synced = synced;
		this.#swap(synced);
		this.#unsubStatus = synced.status.subscribe((s) => this.#status.set(s));
		void synced.start();
	}

	/** Vuelve al modo local (al cerrar sesión). Los datos locales quedan intactos. */
	useLocal(): void {
		if (!this.#synced) return;
		this.#synced = null;
		this.#status.set('local');
		this.#swap(new LocalRepository());
	}

	// — Delegación de la interfaz al repositorio activo —
	loadMarks(): UserData {
		return this.#inner.loadMarks();
	}
	saveMarks(data: UserData): void {
		this.#inner.saveMarks(data);
	}
	loadChecklist(routeId: string, date: string): Set<string> {
		return this.#inner.loadChecklist(routeId, date);
	}
	saveChecklist(routeId: string, date: string, checked: Set<string>): void {
		this.#inner.saveChecklist(routeId, date, checked);
	}
	loadCustomGear(): CustomGearData {
		return this.#inner.loadCustomGear();
	}
	saveCustomGear(data: CustomGearData): void {
		this.#inner.saveCustomGear(data);
	}
	loadSettings(): Settings {
		return this.#inner.loadSettings();
	}
	saveSettings(settings: Settings): void {
		this.#inner.saveSettings(settings);
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	dispose(): void {
		this.#teardownInner();
		this.#listeners.clear();
	}

	/** Reemplaza el repositorio activo, libera el anterior y notifica el cambio. */
	#swap(next: UserDataRepository): void {
		this.#teardownInner();
		this.#inner = next;
		this.#wireInner();
		this.#notify(); // la UI recarga desde el nuevo backend
	}

	#wireInner(): void {
		this.#unsubInner = this.#inner.subscribe(() => this.#notify());
	}

	#teardownInner(): void {
		this.#unsubInner?.();
		this.#unsubInner = null;
		this.#unsubStatus?.();
		this.#unsubStatus = null;
		(this.#inner as { dispose?: () => void }).dispose?.();
	}

	#notify(): void {
		for (const listener of this.#listeners) listener();
	}
}
