/**
 * Configuración del backend opcional de la v4 (SPECS_V4 §A4). Lee variables
 * públicas de entorno; si no están, el backend queda **deshabilitado** y la app
 * funciona 100% en local (coste 0). La `anon key` es pública por diseño: la
 * seguridad vive en las políticas RLS del servidor, no en ocultarla.
 *
 * Activación (cuando se cree el proyecto Supabase gratis, ver supabase/README.md):
 *   PUBLIC_SUPABASE_URL=...   PUBLIC_SUPABASE_ANON_KEY=...
 */

import { env } from '$env/dynamic/public';

export interface BackendConfig {
	url: string;
	anonKey: string;
}

/** Config del backend si está definido por entorno; null = modo solo local. */
export function backendConfig(): BackendConfig | null {
	const url = env.PUBLIC_SUPABASE_URL;
	const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;
	return url && anonKey ? { url, anonKey } : null;
}

/** ¿Hay backend configurado? Si no, no se ofrecen cuentas ni sincronización. */
export function isBackendEnabled(): boolean {
	return backendConfig() !== null;
}
