import { describe, expect, it } from 'vitest';
import { FEDERATIONS, FULL_CAPABILITIES, federationInfo, routeCapabilities } from './federation';

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
});
