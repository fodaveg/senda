import { describe, expect, it } from 'vitest';
import { liveRecords, mergeCollections, mergeSingleton, type Syncable } from './merge';

const rec = (id: string, updated_at: string, deleted = false): Syncable => ({
	id,
	updated_at,
	deleted
});

describe('mergeCollections (LWW por elemento)', () => {
	it('sube lo que solo está en local y aplica lo que solo está en remoto', () => {
		const r = mergeCollections([rec('a', '2026-01-01')], [rec('b', '2026-01-02')]);
		expect(r.toPush.map((x) => x.id)).toEqual(['a']);
		expect(r.toApply.map((x) => x.id)).toEqual(['b']);
		expect(r.merged.map((x) => x.id).sort()).toEqual(['a', 'b']);
	});

	it('gana el más reciente cuando el id existe en ambos', () => {
		const r = mergeCollections([rec('a', '2026-01-03')], [rec('a', '2026-01-01')]);
		expect(r.toPush.map((x) => x.id)).toEqual(['a']); // local más nuevo → subir
		expect(r.toApply).toHaveLength(0);
		expect(r.merged[0].updated_at).toBe('2026-01-03');
	});

	it('aplica el remoto si es más nuevo', () => {
		const r = mergeCollections([rec('a', '2026-01-01')], [rec('a', '2026-01-05')]);
		expect(r.toApply.map((x) => x.id)).toEqual(['a']);
		expect(r.toPush).toHaveLength(0);
		expect(r.merged[0].updated_at).toBe('2026-01-05');
	});

	it('empate → sin operaciones, estado estable', () => {
		const r = mergeCollections([rec('a', '2026-01-01')], [rec('a', '2026-01-01')]);
		expect(r.toPush).toHaveLength(0);
		expect(r.toApply).toHaveLength(0);
		expect(r.merged).toHaveLength(1);
	});

	it('un tombstone más nuevo gana y desaparece de los vivos', () => {
		const r = mergeCollections([rec('a', '2026-01-01')], [rec('a', '2026-02-01', true)]);
		expect(r.merged[0].deleted).toBe(true);
		expect(liveRecords(r.merged)).toHaveLength(0);
		expect(r.toApply).toHaveLength(1);
	});
});

describe('mergeSingleton (preferencias/perfil)', () => {
	it('elige el de updated_at mayor', () => {
		const a = { updated_at: '2026-01-02', v: 'local' };
		const b = { updated_at: '2026-01-01', v: 'remoto' };
		expect(mergeSingleton(a, b)).toEqual({ merged: a, push: true, apply: false });
		expect(mergeSingleton(b, a)).toEqual({ merged: a, push: false, apply: true });
	});

	it('maneja ausencias y empate', () => {
		const a = { updated_at: '2026-01-01' };
		expect(mergeSingleton(a, null).push).toBe(true);
		expect(mergeSingleton(null, a).apply).toBe(true);
		expect(mergeSingleton(null, null).merged).toBeNull();
		expect(mergeSingleton({ updated_at: 't' }, { updated_at: 't' })).toMatchObject({
			push: false,
			apply: false
		});
	});
});
