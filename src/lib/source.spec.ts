import { describe, expect, it } from 'vitest';
import { routeSourceLabel } from './source';

describe('routeSourceLabel', () => {
	it('usa FEMECV cuando la ruta no declara federación', () => {
		expect(routeSourceLabel({})).toBe('FEMECV · oficial');
		expect(routeSourceLabel({ federacion: undefined })).toBe('FEMECV · oficial');
	});

	it('refleja la federación declarada (multi-federación)', () => {
		expect(routeSourceLabel({ federacion: 'FEDME' })).toBe('FEDME · oficial');
	});
});
