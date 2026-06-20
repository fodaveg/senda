import { describe, expect, it } from 'vitest';
import { isStage, parentIdOf, parentOf, stagesOf } from './stages';

const CATALOG = [
	{ id: 'gr-10', name: 'GR-10' },
	{ id: 'gr-10-e01', name: 'GR-10 Etapa 1' },
	{ id: 'gr-10-e02', name: 'GR-10 Etapa 2' },
	{ id: 'gr-10-e10', name: 'GR-10 Etapa 10' },
	{ id: 'pr-cv-77', name: 'PR-CV 77' }
];

describe('relación padre ↔ etapas', () => {
	it('detecta el padre de una etapa', () => {
		expect(parentIdOf('gr-10-e01')).toBe('gr-10');
		expect(parentIdOf('gr-238-e11')).toBe('gr-238');
	});

	it('no confunde rutas normales con etapas', () => {
		expect(parentIdOf('pr-cv-77')).toBeNull();
		expect(isStage('pr-cv-77')).toBe(false);
		expect(isStage('gr-10-e01')).toBe(true);
	});

	it('lista las etapas ordenadas numéricamente (no lexicográfico)', () => {
		const stages = stagesOf('gr-10', CATALOG);
		expect(stages.map((s) => s.id)).toEqual(['gr-10-e01', 'gr-10-e02', 'gr-10-e10']);
		expect(stages[0].order).toBe(1);
	});

	it('una ruta sin etapas devuelve lista vacía', () => {
		expect(stagesOf('pr-cv-77', CATALOG)).toEqual([]);
	});

	it('resuelve el padre existente de una etapa', () => {
		expect(parentOf('gr-10-e02', CATALOG)?.id).toBe('gr-10');
		expect(parentOf('gr-99-e01', CATALOG)).toBeNull();
	});
});
