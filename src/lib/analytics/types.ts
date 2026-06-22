/**
 * Tipos del módulo de analítica **anónima** (SPECS_V4 §B3/§11). Los eventos no
 * llevan `user_id` ni datos personales: identifican el objeto (ruta o material),
 * no a la persona. El backend (solo-inserción) y las vistas agregadas con
 * k-anonimato (`n >= 5`) viven en `supabase/schema.sql`.
 *
 * El SDK queda detrás de la interfaz `AnalyticsClient` para poder mockearlo en
 * tests y conservar la portabilidad del backend.
 */

export type AnalyticsKind = 'favorita' | 'completada' | 'material';

/** Evento anónimo: tipo + payload con la clave del objeto (sin PII). */
export interface AnalyticsEvent {
	kind: AnalyticsKind;
	payload: Record<string, unknown>;
}

/** Fila del ranking de rutas (vista `trending_routes`). */
export interface TrendingRoute {
	route_id: string;
	kind: 'favorita' | 'completada';
	n: number;
}

/** Fila del ranking de material (vista `trending_gear`). */
export interface TrendingGear {
	name: string;
	n: number;
}

/** Contrato del cliente de analítica (Supabase o mock). */
export interface AnalyticsClient {
	/** Inserta un evento anónimo. El gating (opt-in + sesión) es del llamador. */
	track(event: AnalyticsEvent): Promise<void>;
	/** Rankings agregados (legibles por cualquiera; estado vacío si aún no hay). */
	trendingRoutes(): Promise<TrendingRoute[]>;
	trendingGear(): Promise<TrendingGear[]>;
}
