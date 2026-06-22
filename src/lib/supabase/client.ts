/**
 * Cliente Supabase **compartido** (SPECS_V4 §A3/§B2). Un único `SupabaseClient`
 * para toda la app, cargado por **import dinámico** (code-split: solo entra en el
 * bundle cuando hay backend y se usa de verdad) y memoizado. Que sea único evita
 * instanciar varios GoTrue sobre el mismo almacenamiento y garantiza que la
 * sincronización use la **misma sesión** que la autenticación.
 *
 * El SDK queda detrás de esta función para conservar la portabilidad
 * (Supabase Cloud ↔ self-host en Hetzner): el resto de la app no importa el SDK
 * directamente.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackendConfig } from '$lib/config';

let clientPromise: Promise<SupabaseClient> | null = null;

/** Devuelve el cliente compartido, creándolo de forma perezosa la primera vez. */
export function getSupabaseClient(config: BackendConfig): Promise<SupabaseClient> {
	if (!clientPromise) {
		clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
			createClient(config.url, config.anonKey, {
				// Sesión persistente con refresco automático del token (§A3). En Tauri,
				// el almacenamiento seguro se abordará al integrar el deep-link (§A7).
				auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
			})
		);
	}
	return clientPromise;
}
