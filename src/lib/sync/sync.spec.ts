/**
 * Tests de la capa de sincronización (SPECS_V4 §B2): conversores puros
 * local↔registros (round-trip) y `SyncedRepository` contra un `RemoteStore`
 * **mockeado** (sin backend real). Se inyecta un localStorage en memoria.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
	checklistsToRecords,
	customGearToRecords,
	marksToRecords,
	preferencesToSettings,
	recordsToChecklists,
	recordsToCustomGear,
	recordsToMarks,
	settingsToPreferences,
	type ChecklistRecord,
	type CustomGearRecord,
	type OutingRecord,
	type PreferencesRecord,
	type RouteMarkRecord
} from './records';
import type { RemoteStore } from './remote';
import { SyncedRepository } from '$lib/user/syncedRepository';
import {
	emptyUserData,
	liveOutings,
	withOuting,
	withoutOuting,
	withToggledMark
} from '$lib/user/marks';
import { addCustomItem, emptyCustomGearData } from '$lib/user/customGear';
import { DEFAULT_SETTINGS } from '$lib/settings';
import { loadAllChecklists } from '$lib/user/checklist';

class MemoryStorage {
	#map = new Map<string, string>();
	getItem(key: string): string | null {
		return this.#map.has(key) ? this.#map.get(key)! : null;
	}
	setItem(key: string, value: string): void {
		this.#map.set(key, String(value));
	}
	removeItem(key: string): void {
		this.#map.delete(key);
	}
	clear(): void {
		this.#map.clear();
	}
}

/** RemoteStore en memoria; comparte estado entre "dispositivos" en un test. */
class MockRemote implements RemoteStore {
	routeMarks = new Map<string, RouteMarkRecord>();
	outings = new Map<string, OutingRecord>();
	checklists = new Map<string, ChecklistRecord>();
	customGear = new Map<string, CustomGearRecord>();
	preferences: PreferencesRecord | null = null;
	fail = false;

	#guard() {
		if (this.fail) throw new Error('network down');
	}
	async loadRouteMarks() {
		this.#guard();
		return [...this.routeMarks.values()];
	}
	async upsertRouteMarks(records: RouteMarkRecord[]) {
		this.#guard();
		for (const r of records) this.routeMarks.set(r.id, r);
	}
	async loadOutings() {
		this.#guard();
		return [...this.outings.values()];
	}
	async upsertOutings(records: OutingRecord[]) {
		this.#guard();
		for (const r of records) this.outings.set(r.id, r);
	}
	async loadChecklists() {
		this.#guard();
		return [...this.checklists.values()];
	}
	async upsertChecklists(records: ChecklistRecord[]) {
		this.#guard();
		for (const r of records) this.checklists.set(r.id, r);
	}
	async loadCustomGear() {
		this.#guard();
		return [...this.customGear.values()];
	}
	async upsertCustomGear(records: CustomGearRecord[]) {
		this.#guard();
		for (const r of records) this.customGear.set(r.id, r);
	}
	async loadPreferences() {
		this.#guard();
		return this.preferences;
	}
	async upsertPreferences(record: PreferencesRecord) {
		this.#guard();
		this.preferences = record;
	}
}

beforeEach(() => {
	(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});
afterEach(() => {
	delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('conversores local ↔ registros', () => {
	it('marcas: round-trip de toggles + salidas (incluido tombstone)', () => {
		let data = withToggledMark(emptyUserData(), 'pr-1', 'favorita', '2026-06-01T00:00:00.000Z');
		data = withOuting(data, 'pr-1', { date: '2026-05-01' }, '2026-05-01T00:00:00.000Z', 'o1');
		data = withOuting(
			data,
			'pr-1',
			{ date: '2026-04-01', notes: 'vieja' },
			'2026-04-01T00:00:00.000Z',
			'o2'
		);
		data = withoutOuting(data, 'pr-1', 'o2', '2026-06-02T00:00:00.000Z');

		const { marks, outings } = marksToRecords(data);
		expect(marks).toHaveLength(1);
		expect(marks[0]).toMatchObject({ id: 'pr-1', favorita: true, me_gusta: false });
		expect(outings).toHaveLength(2);
		expect(outings.find((o) => o.id === 'o2')!.deleted).toBe(true);

		const back = recordsToMarks(marks, outings);
		expect(back.marks['pr-1'].favorita).toBe(true);
		expect(liveOutings(back.marks['pr-1']).map((o) => o.id)).toEqual(['o1']);
	});

	it('material custom: round-trip', () => {
		const data = addCustomItem(
			emptyCustomGearData(),
			{ name: 'Polaina', category: 'ropa', weight_g: 120, attributes: ['impermeable'] },
			'2026-06-01T00:00:00.000Z'
		);
		expect(recordsToCustomGear(customGearToRecords(data))).toEqual(data);
	});

	it('checklist: round-trip por (ruta, fecha)', () => {
		const rows = [{ key: 'pr-1|2026-06-22', items: ['agua', 'gorra'], updated_at: 'X' }];
		const records = checklistsToRecords(rows);
		expect(records[0]).toMatchObject({
			route_id: 'pr-1',
			date: '2026-06-22',
			checked_ids: ['agua', 'gorra']
		});
		expect(recordsToChecklists(records)).toEqual(rows);
	});

	it('preferencias: el updated_at de la fila es el autoritativo', () => {
		const settings = { ...DEFAULT_SETTINGS, updated_at: '2026-06-01T00:00:00.000Z', weightKg: 70 };
		const record = settingsToPreferences(settings);
		expect(record.updated_at).toBe('2026-06-01T00:00:00.000Z');
		expect(
			preferencesToSettings({ ...record, updated_at: '2026-07-01T00:00:00.000Z' }).updated_at
		).toBe('2026-07-01T00:00:00.000Z');
	});
});

describe('SyncedRepository', () => {
	it('escribe local al instante y empuja al remoto al sincronizar', async () => {
		const remote = new MockRemote();
		const repo = new SyncedRepository(remote, { autoSync: false });
		const data = withToggledMark(emptyUserData(), 'pr-1', 'favorita', '2026-06-01T00:00:00.000Z');
		repo.saveMarks(data);
		// Lectura local inmediata, sin esperar a la red.
		expect(repo.loadMarks().marks['pr-1'].favorita).toBe(true);
		expect(get(repo.status)).toBe('pending');

		await repo.sync();
		expect(get(repo.status)).toBe('synced');
		expect(remote.routeMarks.get('pr-1')?.favorita).toBe(true);
	});

	it('fusiona los datos de otro dispositivo al sincronizar (pull)', async () => {
		const remote = new MockRemote();
		// Dispositivo A sube una favorita y una salida.
		const a = new SyncedRepository(remote, { autoSync: false });
		let data = withToggledMark(emptyUserData(), 'pr-1', 'favorita', '2026-06-01T00:00:00.000Z');
		data = withOuting(data, 'pr-1', { date: '2026-05-01' }, '2026-05-01T00:00:00.000Z', 'o1');
		a.saveMarks(data);
		await a.sync();

		// Dispositivo B (localStorage limpio) sincroniza y recibe lo de A.
		localStorage.clear();
		const b = new SyncedRepository(remote, { autoSync: false });
		expect(b.loadMarks().marks['pr-1']).toBeUndefined();
		await b.sync();
		expect(b.loadMarks().marks['pr-1'].favorita).toBe(true);
		expect(liveOutings(b.loadMarks().marks['pr-1'])).toHaveLength(1);
	});

	it('propaga el borrado de una salida (tombstone) a otro dispositivo', async () => {
		const remote = new MockRemote();
		const a = new SyncedRepository(remote, { autoSync: false });
		let data = withOuting(
			emptyUserData(),
			'pr-1',
			{ date: '2026-05-01' },
			'2026-05-01T00:00:00.000Z',
			'o1'
		);
		a.saveMarks(data);
		await a.sync();

		// B recibe la salida.
		localStorage.clear();
		const b = new SyncedRepository(remote, { autoSync: false });
		await b.sync();
		expect(liveOutings(b.loadMarks().marks['pr-1'])).toHaveLength(1);

		// A la borra y sincroniza; B vuelve a sincronizar y la ve borrada.
		data = withoutOuting(a.loadMarks(), 'pr-1', 'o1', '2026-06-10T00:00:00.000Z');
		a.saveMarks(data);
		await a.sync();
		await b.sync();
		expect(liveOutings(b.loadMarks().marks['pr-1'])).toHaveLength(0);
	});

	it('ante un fallo de red conserva el dato local y queda pendiente', async () => {
		const remote = new MockRemote();
		const repo = new SyncedRepository(remote, { autoSync: false });
		repo.saveCustomGear(
			addCustomItem(
				emptyCustomGearData(),
				{ name: 'Silbato', category: 'seguridad', weight_g: 10, attributes: [] },
				'2026-06-01T00:00:00.000Z'
			)
		);
		remote.fail = true;
		await repo.sync();
		expect(get(repo.status)).toBe('pending');
		// El dato local sigue intacto y la cola offline persiste.
		expect(repo.loadCustomGear().items).toHaveLength(1);
		expect(localStorage.getItem('senderos-cv:sync-dirty')).toBeTruthy();

		// Al recuperar la red, la siguiente sincronización vacía la cola.
		remote.fail = false;
		await repo.sync();
		expect(get(repo.status)).toBe('synced');
		expect(remote.customGear.size).toBe(1);
		expect(localStorage.getItem('senderos-cv:sync-dirty')).toBeNull();
	});

	it('preferencias (singleton): gana el updated_at más reciente', async () => {
		const remote = new MockRemote();
		const repo = new SyncedRepository(remote, { autoSync: false });
		repo.saveSettings({ ...DEFAULT_SETTINGS, weightKg: 80 });
		await repo.sync();
		expect(remote.preferences?.data.weightKg).toBe(80);

		// Otro dispositivo con un cambio más nuevo gana al aplicarse.
		remote.preferences = settingsToPreferences({
			...DEFAULT_SETTINGS,
			weightKg: 99,
			updated_at: '2999-01-01T00:00:00.000Z'
		});
		await repo.sync();
		expect(repo.loadSettings().weightKg).toBe(99);
	});

	it('el checklist se reconstruye intacto tras pull en otro dispositivo', async () => {
		const remote = new MockRemote();
		const a = new SyncedRepository(remote, { autoSync: false });
		a.saveChecklist('pr-1', '2026-06-22', new Set(['agua', 'gorra']));
		await a.sync();

		localStorage.clear();
		const b = new SyncedRepository(remote, { autoSync: false });
		await b.sync();
		expect(b.loadChecklist('pr-1', '2026-06-22')).toEqual(new Set(['agua', 'gorra']));
		expect(loadAllChecklists()).toHaveLength(1);
	});
});
