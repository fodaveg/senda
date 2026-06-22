/**
 * Inyección del módulo de auth vía contexto Svelte (SPECS_V4 §A3/§A4), en
 * paralelo al repositorio de datos de usuario. El layout raíz llamará a
 * `provideAuth()`; los componentes (UI de cuentas en M3) usarán `getAuth()`.
 *
 * Si no hay backend configurado (sin `PUBLIC_SUPABASE_*`), el contexto queda
 * **deshabilitado** (`enabled: false`): la app no ofrece cuentas y funciona
 * 100% en local, como en v3. La cuenta nunca es obligatoria.
 */

import { getContext, setContext } from 'svelte';
import { backendConfig } from '$lib/config';
import { createSupabaseAuthClient } from './supabaseAuth';
import { createSessionStore, type SessionStore } from './session';
import type { AuthClient } from './types';

const KEY = Symbol('auth-context');

export interface AuthContext {
	/** ¿Hay backend? Si no, no se muestran login ni sincronización. */
	enabled: boolean;
	client: AuthClient | null;
	session: SessionStore | null;
}

const DISABLED: AuthContext = { enabled: false, client: null, session: null };

/** Construye el contexto a partir de la config de entorno (o deshabilitado). */
function buildAuth(): AuthContext {
	const config = backendConfig();
	if (!config) return DISABLED;
	const client = createSupabaseAuthClient(config);
	return { enabled: true, client, session: createSessionStore(client) };
}

/**
 * Registra el contexto de auth en el árbol actual. Llamar durante la
 * inicialización del componente (layout raíz). `override` permite inyectar un
 * contexto de prueba. Devuelve el contexto para usarlo en el mismo componente.
 */
export function provideAuth(override?: AuthContext): AuthContext {
	const ctx = override ?? buildAuth();
	setContext(KEY, ctx);
	return ctx;
}

/** Obtiene el contexto de auth; deshabilitado si no hay proveedor ni backend. */
export function getAuth(): AuthContext {
	return getContext<AuthContext | undefined>(KEY) ?? DISABLED;
}
