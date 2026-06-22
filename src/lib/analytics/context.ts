/**
 * Inyección del módulo de analítica vía contexto Svelte (SPECS_V4 §B3/§11), en
 * paralelo a auth y al repositorio. Centraliza el **gating**: un evento solo se
 * envía si hay backend, el usuario dio su consentimiento (opt-in) y hay sesión.
 * Además valida el evento (anónimo, sin PII) antes de enviarlo. La analítica es
 * "fire-and-forget": nunca rompe ni bloquea la UI (errores silenciados).
 *
 * Las vistas de tendencias (`trendingRoutes/Gear`) NO están gateadas por opt-in:
 * son públicas y solo necesitan que haya backend.
 */

import { getContext, setContext } from 'svelte';
import { backendConfig } from '$lib/config';
import { createSupabaseAnalyticsClient } from './supabaseAnalytics';
import { isValidEvent } from './events';
import type { AnalyticsClient, AnalyticsEvent } from './types';

const KEY = Symbol('analytics-context');

export interface AnalyticsContext {
	/** ¿Hay backend? Si no, ni se envía ni hay tendencias. */
	enabled: boolean;
	client: AnalyticsClient | null;
	/** Envía un evento si procede (opt-in + sesión + válido); si no, no-op. */
	track(event: AnalyticsEvent): void;
}

const DISABLED: AnalyticsContext = { enabled: false, client: null, track: () => {} };

export interface AnalyticsSetup {
	/** Cliente a usar (por defecto, el de Supabase si hay backend). */
	client?: AnalyticsClient | null;
	/** ¿Puede enviarse ahora? (opt-in activado **y** sesión iniciada). */
	canSend: () => boolean;
}

/** Construye el contexto a partir de la config y las condiciones de envío. */
export function buildAnalytics(setup: AnalyticsSetup): AnalyticsContext {
	const config = backendConfig();
	const client = setup.client ?? (config ? createSupabaseAnalyticsClient(config) : null);
	if (!client) return DISABLED;
	return {
		enabled: true,
		client,
		track(event) {
			if (!setup.canSend() || !isValidEvent(event)) return;
			// Fire-and-forget: la analítica jamás interrumpe la experiencia.
			void client.track(event).catch(() => {});
		}
	};
}

/** Registra el contexto de analítica en el árbol actual (layout raíz). */
export function provideAnalytics(ctx: AnalyticsContext): AnalyticsContext {
	setContext(KEY, ctx);
	return ctx;
}

/** Obtiene el contexto de analítica; deshabilitado si no hay proveedor. */
export function getAnalytics(): AnalyticsContext {
	return getContext<AnalyticsContext | undefined>(KEY) ?? DISABLED;
}
