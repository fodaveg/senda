import { describe, expect, it } from 'vitest';
import { makeWaypoint, parseWaypointsImport, WAYPOINTS_SCHEMA_VERSION } from './waypoints';

describe('waypoints', () => {
	it('makeWaypoint crea un punto válido con id y fecha', () => {
		const wp = makeWaypoint(39.5, -0.4, 'Coche');
		expect(wp.lat).toBe(39.5);
		expect(wp.lon).toBe(-0.4);
		expect(wp.note).toBe('Coche');
		expect(wp.id).toBeTruthy();
		expect(wp.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('parseWaypointsImport valida el esquema versionado', () => {
		const wp = makeWaypoint(39, -0.5, 'x');
		const data = { schema: WAYPOINTS_SCHEMA_VERSION, byRoute: { 'pr-cv-77': [wp] } };
		expect(parseWaypointsImport(data)).toEqual(data);
		expect(() => parseWaypointsImport({ schema: 99, byRoute: {} })).toThrow();
	});
});
