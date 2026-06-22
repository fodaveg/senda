/**
 * Tests de LocalRepository (SPECS_V4 §A1): el repositorio local debe ser un
 * envoltorio fiel de la persistencia de v3 (round-trip por dominio) y notificar
 * a los suscriptores en cada guardado. Como el entorno de test es `node` (sin
 * localStorage), se inyecta un almacén en memoria.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalRepository } from './localRepository';
import { emptyUserData } from './marks';
import { emptyCustomGearData } from './customGear';
import { DEFAULT_SETTINGS } from '$lib/settings';

/** localStorage mínimo en memoria para los tests (API síncrona del navegador). */
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

beforeEach(() => {
	(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

afterEach(() => {
	delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('LocalRepository', () => {
	it('devuelve estado vacío cuando no hay nada guardado', () => {
		const repo = new LocalRepository();
		expect(repo.loadMarks()).toEqual(emptyUserData());
		expect(repo.loadCustomGear()).toEqual(emptyCustomGearData());
		expect(repo.loadChecklist('ruta-1', '2026-06-22')).toEqual(new Set());
	});

	it('hace round-trip de las marcas', () => {
		const repo = new LocalRepository();
		const data = { ...emptyUserData(), marks: { 'ruta-1': { favorita: true } } };
		repo.saveMarks(data);
		expect(repo.loadMarks()).toEqual(data);
	});

	it('hace round-trip del checklist por (ruta, fecha)', () => {
		const repo = new LocalRepository();
		repo.saveChecklist('ruta-1', '2026-06-22', new Set(['agua', 'gorra']));
		expect(repo.loadChecklist('ruta-1', '2026-06-22')).toEqual(new Set(['agua', 'gorra']));
		// Otra fecha no comparte estado.
		expect(repo.loadChecklist('ruta-1', '2026-06-23')).toEqual(new Set());
	});

	it('hace round-trip del material custom', () => {
		const repo = new LocalRepository();
		const gear = {
			...emptyCustomGearData(),
			items: [
				{ id: 'silbato', name: 'Silbato', category: 'seguridad', weight_g: 10, attributes: [] }
			]
		};
		repo.saveCustomGear(gear);
		expect(repo.loadCustomGear()).toEqual(gear);
	});

	it('hace round-trip de los ajustes', () => {
		const repo = new LocalRepository();
		const settings = { ...DEFAULT_SETTINGS, theme: 'oscuro' as const, weightKg: 72 };
		repo.saveSettings(settings);
		expect(repo.loadSettings()).toEqual(settings);
	});

	it('notifica a los suscriptores en cada guardado y respeta la baja', () => {
		const repo = new LocalRepository();
		const listener = vi.fn();
		const unsubscribe = repo.subscribe(listener);

		repo.saveMarks(emptyUserData());
		repo.saveSettings({ ...DEFAULT_SETTINGS });
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
		repo.saveCustomGear(emptyCustomGearData());
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
