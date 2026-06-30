import { describe, expect, it } from 'vitest';
import {
	FEDERATIONS,
	FULL_CAPABILITIES,
	HIDDEN_FEDERATIONS,
	federationInfo,
	isRouteVisible,
	routeCapabilities
} from './federation';

describe('federación / capacidades', () => {
	it('FEMECV publica todas las capacidades', () => {
		expect(FEDERATIONS.FEMECV.capabilities).toEqual(FULL_CAPABILITIES);
		expect(FEDERATIONS.FEMECV.comunidad).toBe('Comunitat Valenciana');
	});

	it('FNDME (Navarra) solo publica estado y etapas', () => {
		const cap = FEDERATIONS.FNDME.capabilities;
		expect(cap.estado).toBe(true);
		expect(cap.etapas).toBe(true);
		expect(cap.mide).toBe(false);
		expect(cap.agua).toBe(false);
		expect(cap.fauna).toBe(false);
	});

	it('federationInfo cae a FEMECV con id desconocido o vacío', () => {
		expect(federationInfo(undefined).id).toBe('FEMECV');
		expect(federationInfo('NOEXISTE').id).toBe('FEMECV');
		expect(federationInfo('FNDME').id).toBe('FNDME');
	});

	it('routeCapabilities prioriza las explícitas, luego el preset, luego FULL', () => {
		// Explícitas en la ruta.
		const explicit = { ...FULL_CAPABILITIES, mide: false };
		expect(routeCapabilities({ federacion: 'FEMECV', capabilities: explicit })).toEqual(explicit);
		// Preset por federación.
		expect(routeCapabilities({ federacion: 'FNDME' }).mide).toBe(false);
		// Sin federación → FEMECV (FULL).
		expect(routeCapabilities({})).toEqual(FULL_CAPABILITIES);
	});

	it('isRouteVisible oculta las federaciones de HIDDEN_FEDERATIONS', () => {
		// FNDME (Navarra) está deshabilitada temporalmente.
		expect(HIDDEN_FEDERATIONS.has('FNDME')).toBe(true);
		expect(isRouteVisible({ federacion: 'FNDME' })).toBe(false);
		// FEMECV y rutas sin federación siempre visibles.
		expect(isRouteVisible({ federacion: 'FEMECV' })).toBe(true);
		expect(isRouteVisible({})).toBe(true);
	});
});
