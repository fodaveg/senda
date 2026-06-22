/**
 * Repositorio de datos de usuario con sincronización (SPECS_V4 §B2). Implementa
 * la **misma** interfaz `UserDataRepository` que `LocalRepository`, de modo que
 * la UI no cambia: las lecturas y escrituras son **locales e instantáneas**
 * (offline-first) y la sincronización con el backend ocurre en segundo plano.
 *
 * Flujo de cada sincronización, por dominio: `pull` remoto → `merge.ts` (LWW por
 * elemento) → aplica en local lo remoto más nuevo y empuja lo local más nuevo.
 * Una **cola offline** persistida (conjunto de dominios "sucios") recuerda que
 * hay cambios sin confirmar; se vacía al reconectar (`online`) o en el siguiente
 * `sync()`. Nunca se pierde dato local: ante un fallo de red, se conserva todo y
 * el estado pasa a "sin conexión".
 */

import { writable, type Readable } from 'svelte/store';
import type { UserDataRepository } from './repository';
import { loadUserData, saveUserData, type UserData } from './marks';
import {
	loadChecklist as loadChecklistData,
	saveChecklist as saveChecklistData,
	loadAllChecklists,
	replaceAllChecklists
} from './checklist';
import { loadCustomGear, saveCustomGear, type CustomGearData } from './customGear';
import { loadSettings, saveSettings, stampSettings, type Settings } from '$lib/settings';
import { mergeCollections, mergeSingleton } from './sync/merge';
import type { RemoteStore } from '$lib/sync/remote';
import {
	checklistsToRecords,
	customGearToRecords,
	marksToRecords,
	preferencesToSettings,
	recordsToChecklists,
	recordsToCustomGear,
	recordsToMarks,
	settingsToPreferences
} from '$lib/sync/records';

/** Estado del indicador de sincronización (SPECS_V4 §B2). */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline';

/** Dominios sincronizables (clave de la cola offline). */
type Domain = 'marks' | 'custom_gear' | 'checklists' | 'preferences';
const DOMAINS: Domain[] = ['marks', 'custom_gear', 'checklists', 'preferences'];

const KEY_PREFIX = 'senderos-cv:';
const DIRTY_KEY = 'senderos-cv:sync-dirty';

export interface SyncedRepositoryOptions {
	/** Lanza una sincronización (debounced) tras cada guardado. Default: true. */
	autoSync?: boolean;
	/** Retardo del debounce de auto-sync, ms. Default: 600. */
	debounceMs?: number;
}

export class SyncedRepository implements UserDataRepository {
	#remote: RemoteStore;
	#listeners = new Set<() => void>();
	#status = writable<SyncStatus>('synced');
	#dirty: Set<Domain>;
	#syncing = false;
	#autoSync: boolean;
	#debounceMs: number;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#onStorage?: (e: StorageEvent) => void;
	#onOnline?: () => void;

	constructor(remote: RemoteStore, opts: SyncedRepositoryOptions = {}) {
		this.#remote = remote;
		this.#autoSync = opts.autoSync ?? true;
		this.#debounceMs = opts.debounceMs ?? 600;
		this.#dirty = this.#loadDirty();

		if (typeof window !== 'undefined') {
			this.#onStorage = (e: StorageEvent) => {
				if (!e.key || e.key.startsWith(KEY_PREFIX)) this.#notify();
			};
			window.addEventListener('storage', this.#onStorage);
			// Al reconectar, vaciar la cola offline.
			this.#onOnline = () => {
				if (this.#dirty.size > 0) void this.sync();
			};
			window.addEventListener('online', this.#onOnline);
		}
		this.#refreshIdleStatus();
	}

	/** Estado de sincronización para el indicador de la UI. */
	get status(): Readable<SyncStatus> {
		return { subscribe: this.#status.subscribe };
	}

	/** Arranca la sincronización: un `pull` inicial + empuje de lo pendiente. */
	async start(): Promise<void> {
		await this.sync();
	}

	// ─── Lecturas/escrituras locales (instantáneas, offline-first) ────────────

	loadMarks(): UserData {
		return loadUserData();
	}
	saveMarks(data: UserData): void {
		saveUserData(data);
		this.#notify();
		this.#touch('marks');
	}

	loadChecklist(routeId: string, date: string): Set<string> {
		return loadChecklistData(routeId, date);
	}
	saveChecklist(routeId: string, date: string, checked: Set<string>): void {
		saveChecklistData(routeId, date, checked);
		this.#notify();
		this.#touch('checklists');
	}

	loadCustomGear(): CustomGearData {
		return loadCustomGear();
	}
	saveCustomGear(data: CustomGearData): void {
		saveCustomGear(data);
		this.#notify();
		this.#touch('custom_gear');
	}

	loadSettings(): Settings {
		return loadSettings();
	}
	saveSettings(settings: Settings): void {
		// Un guardado del usuario sella `updated_at` (igual que LocalRepository).
		saveSettings(stampSettings(settings));
		this.#notify();
		this.#touch('preferences');
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Libera listeners y temporizadores. */
	dispose(): void {
		if (typeof window !== 'undefined') {
			if (this.#onStorage) window.removeEventListener('storage', this.#onStorage);
			if (this.#onOnline) window.removeEventListener('online', this.#onOnline);
		}
		if (this.#timer) clearTimeout(this.#timer);
		this.#listeners.clear();
	}

	// ─── Sincronización ───────────────────────────────────────────────────────

	/**
	 * Reconcilia local y remoto en todos los dominios. Idempotente y seguro de
	 * reintentar (la fusión es LWW). Ante un fallo de red conserva todo en local y
	 * deja el estado en "sin conexión".
	 */
	async sync(): Promise<void> {
		if (this.#syncing) return;
		this.#syncing = true;
		this.#status.set('syncing');
		let changed = false;
		try {
			changed = (await this.#syncMarks()) || changed;
			changed = (await this.#syncCustomGear()) || changed;
			changed = (await this.#syncChecklists()) || changed;
			changed = (await this.#syncPreferences()) || changed;
			this.#dirty.clear();
			this.#saveDirty();
			this.#status.set('synced');
		} catch {
			// Offline o backend caído: no se pierde nada; se reintenta más tarde.
			for (const d of DOMAINS) this.#dirty.add(d);
			this.#saveDirty();
			this.#status.set(this.#isOffline() ? 'offline' : 'pending');
		} finally {
			this.#syncing = false;
			if (changed) this.#notify();
		}
	}

	async #syncMarks(): Promise<boolean> {
		const { marks: localMarks, outings: localOutings } = marksToRecords(loadUserData());
		const [remoteMarks, remoteOutings] = await Promise.all([
			this.#remote.loadRouteMarks(),
			this.#remote.loadOutings()
		]);
		const m = mergeCollections(localMarks, remoteMarks);
		const o = mergeCollections(localOutings, remoteOutings);
		let changed = false;
		if (m.toApply.length || o.toApply.length) {
			saveUserData(recordsToMarks(m.merged, o.merged));
			changed = true;
		}
		if (m.toPush.length) await this.#remote.upsertRouteMarks(m.toPush);
		if (o.toPush.length) await this.#remote.upsertOutings(o.toPush);
		return changed;
	}

	async #syncCustomGear(): Promise<boolean> {
		const local = customGearToRecords(loadCustomGear());
		const remote = await this.#remote.loadCustomGear();
		const { merged, toPush, toApply } = mergeCollections(local, remote);
		let changed = false;
		if (toApply.length) {
			saveCustomGear(recordsToCustomGear(merged));
			changed = true;
		}
		if (toPush.length) await this.#remote.upsertCustomGear(toPush);
		return changed;
	}

	async #syncChecklists(): Promise<boolean> {
		const local = checklistsToRecords(loadAllChecklists());
		const remote = await this.#remote.loadChecklists();
		const { merged, toPush, toApply } = mergeCollections(local, remote);
		let changed = false;
		if (toApply.length) {
			replaceAllChecklists(recordsToChecklists(merged));
			changed = true;
		}
		if (toPush.length) await this.#remote.upsertChecklists(toPush);
		return changed;
	}

	async #syncPreferences(): Promise<boolean> {
		const local = settingsToPreferences(loadSettings());
		const remote = await this.#remote.loadPreferences();
		const { merged, push, apply } = mergeSingleton(local, remote);
		let changed = false;
		if (apply && merged) {
			saveSettings(preferencesToSettings(merged));
			changed = true;
		}
		if (push && merged) await this.#remote.upsertPreferences(merged);
		return changed;
	}

	// ─── Cola offline (conjunto de dominios sucios, persistido) ───────────────

	#touch(domain: Domain): void {
		this.#dirty.add(domain);
		this.#saveDirty();
		this.#status.set(this.#isOffline() ? 'offline' : 'pending');
		this.#scheduleSync();
	}

	#scheduleSync(): void {
		if (!this.#autoSync || typeof setTimeout === 'undefined') return;
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.sync(), this.#debounceMs);
	}

	#refreshIdleStatus(): void {
		this.#status.set(this.#dirty.size > 0 ? (this.#isOffline() ? 'offline' : 'pending') : 'synced');
	}

	#isOffline(): boolean {
		return typeof navigator !== 'undefined' && navigator.onLine === false;
	}

	#loadDirty(): Set<Domain> {
		if (typeof localStorage === 'undefined') return new Set();
		try {
			const raw = localStorage.getItem(DIRTY_KEY);
			if (!raw) return new Set();
			const arr = JSON.parse(raw);
			return new Set(Array.isArray(arr) ? arr.filter((d): d is Domain => DOMAINS.includes(d)) : []);
		} catch {
			return new Set();
		}
	}

	#saveDirty(): void {
		if (typeof localStorage === 'undefined') return;
		if (this.#dirty.size === 0) localStorage.removeItem(DIRTY_KEY);
		else localStorage.setItem(DIRTY_KEY, JSON.stringify([...this.#dirty]));
	}

	#notify(): void {
		for (const listener of this.#listeners) listener();
	}
}
