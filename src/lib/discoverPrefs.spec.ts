import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDiscoverPrefs, saveDiscoverPrefs } from './discoverPrefs';

class MemoryStorage {
	#map = new Map<string, string>();
	getItem(k: string) {
		return this.#map.has(k) ? this.#map.get(k)! : null;
	}
	setItem(k: string, v: string) {
		this.#map.set(k, String(v));
	}
	removeItem(k: string) {
		this.#map.delete(k);
	}
}

beforeEach(() => {
	(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});
afterEach(() => {
	delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('discoverPrefs', () => {
	it('por defecto no hay filtro guardado', () => {
		expect(loadDiscoverPrefs()).toEqual({ province: null, zone: null });
	});

	it('hace round-trip del filtro geográfico', () => {
		saveDiscoverPrefs({ province: 'valencia', zone: 'serranos' });
		expect(loadDiscoverPrefs()).toEqual({ province: 'valencia', zone: 'serranos' });
	});

	it('ignora una provincia inválida (tolerante)', () => {
		localStorage.setItem(
			'senderoscv:discover-prefs',
			JSON.stringify({ province: 'madrid', zone: 123 })
		);
		expect(loadDiscoverPrefs()).toEqual({ province: null, zone: null });
	});
});
