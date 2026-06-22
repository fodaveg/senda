/**
 * Implementación de `AnalyticsClient` sobre **Supabase** (SPECS_V4 §B3/§11). Usa
 * el cliente compartido. Inserta eventos anónimos en `analytics_events` (la
 * política del servidor es solo-inserción para autenticados) y lee los rankings
 * agregados de las vistas `trending_routes`/`trending_gear` (legibles por
 * cualquiera, con k-anonimato `n >= 5`). **zod** valida lo que baja.
 *
 * El gating (opt-in + sesión) NO vive aquí, sino en el contexto (`context.ts`):
 * este cliente asume que ya se decidió enviar. Validar el evento es del llamador.
 */

import { z } from 'zod';
import type { BackendConfig } from '$lib/config';
import { getSupabaseClient } from '$lib/supabase/client';
import type { AnalyticsClient, AnalyticsEvent, TrendingGear, TrendingRoute } from './types';

const trendingRouteRow = z.object({
	route_id: z.string(),
	kind: z.enum(['favorita', 'completada']),
	n: z.number()
});
const trendingGearRow = z.object({
	name: z.string(),
	n: z.number()
});

function parseRows<T>(rows: unknown[], schema: z.ZodType<T>): T[] {
	const out: T[] = [];
	for (const row of rows) {
		const parsed = schema.safeParse(row);
		if (parsed.success) out.push(parsed.data);
	}
	return out;
}

export function createSupabaseAnalyticsClient(config: BackendConfig): AnalyticsClient {
	const client = () => getSupabaseClient(config);

	return {
		async track(event: AnalyticsEvent) {
			const sb = await client();
			const { error } = await sb
				.from('analytics_events')
				.insert({ kind: event.kind, payload: event.payload });
			if (error) throw new Error(error.message);
		},
		async trendingRoutes(): Promise<TrendingRoute[]> {
			const sb = await client();
			const { data, error } = await sb.from('trending_routes').select('route_id, kind, n');
			if (error) throw new Error(error.message);
			return parseRows(data ?? [], trendingRouteRow);
		},
		async trendingGear(): Promise<TrendingGear[]> {
			const sb = await client();
			const { data, error } = await sb.from('trending_gear').select('name, n');
			if (error) throw new Error(error.message);
			return parseRows(data ?? [], trendingGearRow);
		}
	};
}
