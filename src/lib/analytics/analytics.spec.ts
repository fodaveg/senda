/**
 * Tests de la analítica anónima (SPECS_V4 §B3/§11): forma y validación de los
 * eventos (sin PII) y el **gating** del contexto (solo envía con opt-in + sesión
 * y eventos válidos), con un `AnalyticsClient` mockeado.
 */

import { describe, expect, it, vi } from 'vitest';
import { gearEvent, isValidEvent, normalizeGearName, routeEvent } from './events';
import { buildAnalytics } from './context';
import type { AnalyticsClient, AnalyticsEvent } from './types';

describe('eventos de analítica', () => {
	it('construye eventos de ruta y material con payload anónimo', () => {
		expect(routeEvent('favorita', 'pr-1')).toEqual({
			kind: 'favorita',
			payload: { route_id: 'pr-1' }
		});
		expect(gearEvent('  Manta Térmica ')).toEqual({
			kind: 'material',
			payload: { name: 'manta térmica' }
		});
		expect(normalizeGearName('  GORRO ')).toBe('gorro');
	});

	it('valida la forma y rechaza PII o payloads vacíos', () => {
		expect(isValidEvent(routeEvent('completada', 'gr-1'))).toBe(true);
		expect(isValidEvent({ kind: 'material', payload: { name: 'silbato' } })).toBe(true);
		// Tipo desconocido.
		expect(isValidEvent({ kind: 'otro' as never, payload: { route_id: 'x' } })).toBe(false);
		// Sin route_id ni name.
		expect(isValidEvent({ kind: 'favorita', payload: {} })).toBe(false);
		// Con PII → rechazado.
		expect(isValidEvent({ kind: 'favorita', payload: { route_id: 'x', user_id: 'u1' } })).toBe(
			false
		);
		expect(isValidEvent({ kind: 'material', payload: { name: 'x', email: 'a@b.c' } })).toBe(false);
	});
});

/** Cliente mock que registra los track recibidos. */
function mockClient(): AnalyticsClient & { sent: AnalyticsEvent[] } {
	const sent: AnalyticsEvent[] = [];
	return {
		sent,
		track: vi.fn(async (e: AnalyticsEvent) => {
			sent.push(e);
		}),
		trendingRoutes: vi.fn(async () => [{ route_id: 'pr-1', kind: 'favorita' as const, n: 7 }]),
		trendingGear: vi.fn(async () => [{ name: 'gorro', n: 5 }])
	};
}

describe('gating del contexto de analítica', () => {
	it('no envía si no se puede (opt-in off o sin sesión)', () => {
		const client = mockClient();
		const ctx = buildAnalytics({ client, canSend: () => false });
		ctx.track(routeEvent('favorita', 'pr-1'));
		expect(client.sent).toHaveLength(0);
	});

	it('envía eventos válidos cuando se puede', async () => {
		const client = mockClient();
		const ctx = buildAnalytics({ client, canSend: () => true });
		ctx.track(routeEvent('favorita', 'pr-1'));
		await Promise.resolve();
		expect(client.sent).toEqual([{ kind: 'favorita', payload: { route_id: 'pr-1' } }]);
	});

	it('nunca envía un evento con PII aunque se pueda', () => {
		const client = mockClient();
		const ctx = buildAnalytics({ client, canSend: () => true });
		ctx.track({ kind: 'favorita', payload: { route_id: 'x', email: 'a@b.c' } });
		expect(client.sent).toHaveLength(0);
	});

	it('un fallo del cliente no propaga (fire-and-forget)', async () => {
		const client = mockClient();
		client.track = vi.fn(async () => {
			throw new Error('network');
		});
		const ctx = buildAnalytics({ client, canSend: () => true });
		expect(() => ctx.track(routeEvent('favorita', 'pr-1'))).not.toThrow();
		await Promise.resolve();
	});

	it('expone tendencias del cliente', async () => {
		const client = mockClient();
		const ctx = buildAnalytics({ client, canSend: () => false });
		expect(ctx.enabled).toBe(true);
		expect(await ctx.client!.trendingGear()).toEqual([{ name: 'gorro', n: 5 }]);
	});
});
