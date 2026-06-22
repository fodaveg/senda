/**
 * Adaptador de `AuthClient` para **Supabase** (SPECS_V4 §A3). Aísla el SDK del
 * proveedor tras la interfaz `AuthClient` para mantener la portabilidad
 * (Supabase Cloud ↔ self-host en Hetzner): el resto de la app no sabe qué
 * backend hay detrás.
 *
 * El SDK se carga por **import dinámico**: solo entra en el bundle cuando hay
 * backend configurado y se usa de verdad, de modo que la app sigue siendo
 * offline-first y ligera (la cuenta es un "por si acaso" opcional).
 *
 * Errores **tipados** (`AuthError`): el llamador distingue credenciales, email
 * ya en uso, rate-limit o red sin leer cadenas del proveedor.
 */

import type { AuthError as SbAuthError, Session as SbSession } from '@supabase/supabase-js';
import type { BackendConfig } from '$lib/config';
import { getSupabaseClient } from '$lib/supabase/client';
import { AuthError, type AuthClient, type AuthErrorKind, type Session } from './types';

/** Traduce la sesión del SDK a nuestro tipo `Session` (epoch ms). */
function mapSession(session: SbSession | null): Session | null {
	if (!session?.user) return null;
	return {
		user: { id: session.user.id, email: session.user.email ?? null },
		// Supabase da expires_at en segundos; lo normalizamos a ms.
		expiresAt: (session.expires_at ?? 0) * 1000
	};
}

/** Clasifica el error del proveedor en una de nuestras categorías estables. */
function classify(error: SbAuthError): AuthErrorKind {
	const status = error.status ?? 0;
	const msg = error.message.toLowerCase();
	if (status === 429) return 'rate_limit';
	if (msg.includes('email not confirmed')) return 'email_not_confirmed';
	if (msg.includes('already registered') || msg.includes('already been registered')) {
		return 'email_taken';
	}
	if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
		return 'invalid_credentials';
	}
	return 'unknown';
}

function toAuthError(error: SbAuthError): AuthError {
	return new AuthError(classify(error), error.message);
}

/**
 * Crea un `AuthClient` respaldado por Supabase. El cliente del SDK se instancia
 * de forma perezosa (import dinámico memoizado) en el primer uso.
 */
export function createSupabaseAuthClient(config: BackendConfig): AuthClient {
	const client = () => getSupabaseClient(config);

	/** Envuelve una llamada del SDK convirtiendo un fallo de red (excepción) en
	 *  `AuthError('network')`. La comprobación del `{ error }` del proveedor la
	 *  hace cada método, porque la forma del `data` varía entre llamadas. */
	async function net<T>(fn: () => Promise<T>): Promise<T> {
		try {
			return await fn();
		} catch (e) {
			throw new AuthError('network', e instanceof Error ? e.message : 'Error de red');
		}
	}

	return {
		async signUp(email, password) {
			const sb = await client();
			const { data, error } = await net(() => sb.auth.signUp({ email, password }));
			if (error) throw toAuthError(error);
			// session === null cuando el proyecto exige confirmación por correo.
			return mapSession(data.session);
		},
		async signIn(email, password) {
			const sb = await client();
			const { data, error } = await net(() => sb.auth.signInWithPassword({ email, password }));
			if (error) throw toAuthError(error);
			const session = mapSession(data.session);
			if (!session) throw new AuthError('unknown', 'Inicio de sesión sin sesión devuelta.');
			return session;
		},
		async signOut() {
			const sb = await client();
			const { error } = await net(() => sb.auth.signOut());
			if (error) throw toAuthError(error);
		},
		async currentSession() {
			const sb = await client();
			const { data, error } = await net(() => sb.auth.getSession());
			if (error) throw toAuthError(error);
			return mapSession(data.session);
		},
		async requestPasswordReset(email) {
			const sb = await client();
			const { error } = await net(() => sb.auth.resetPasswordForEmail(email));
			if (error) throw toAuthError(error);
		},
		async updatePassword(newPassword) {
			const sb = await client();
			const { error } = await net(() => sb.auth.updateUser({ password: newPassword }));
			if (error) throw toAuthError(error);
		},
		async verifyOtp(email, code) {
			const sb = await client();
			const { data, error } = await net(() =>
				sb.auth.verifyOtp({ email, token: code, type: 'email' })
			);
			if (error) throw toAuthError(error);
			const session = mapSession(data.session);
			if (!session) throw new AuthError('unknown', 'OTP verificado sin sesión devuelta.');
			return session;
		}
	};
}
