/**
 * Store de sesión de Svelte (SPECS_V4 §A3). Expone el estado de autenticación
 * (`loading` / `anonymous` / `authenticated`) a la UI y orquesta las operaciones
 * sobre un `AuthClient` **inyectable** (el adaptador real de Supabase o un mock
 * en tests). No conoce el proveedor: solo la interfaz.
 *
 * Degradación elegante: si `init()` falla por red, la sesión queda `anonymous`
 * (modo local), nunca rota. Los errores de las acciones explícitas (signIn…) sí
 * se propagan para que la UI los muestre.
 */

import { writable, type Readable } from 'svelte/store';
import type { AuthClient, AuthUser, Session } from './types';

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

export interface SessionState {
	status: SessionStatus;
	user: AuthUser | null;
	session: Session | null;
}

export interface SessionStore extends Readable<SessionState> {
	/** Carga la sesión persistida al arrancar. Sin red → queda anónima. */
	init(): Promise<void>;
	signIn(email: string, password: string): Promise<void>;
	/** Devuelve la sesión, o `null` si el registro requiere confirmar el correo. */
	signUp(email: string, password: string): Promise<Session | null>;
	signOut(): Promise<void>;
	/** Borra la cuenta en el servidor y vuelve a estado anónimo (datos locales intactos). */
	deleteAccount(): Promise<void>;
}

const ANON: SessionState = { status: 'anonymous', user: null, session: null };

/** Crea el store a partir de un `AuthClient`. Una instancia por sesión de app. */
export function createSessionStore(client: AuthClient): SessionStore {
	const { subscribe, set } = writable<SessionState>({
		status: 'loading',
		user: null,
		session: null
	});

	function apply(session: Session | null): void {
		set(session ? { status: 'authenticated', user: session.user, session } : ANON);
	}

	return {
		subscribe,
		async init() {
			try {
				apply(await client.currentSession());
			} catch {
				// Sin conexión o backend caído: modo local, sin romper.
				set(ANON);
			}
		},
		async signIn(email, password) {
			apply(await client.signIn(email, password));
		},
		async signUp(email, password) {
			const session = await client.signUp(email, password);
			if (session) apply(session);
			return session;
		},
		async signOut() {
			await client.signOut();
			set(ANON);
		},
		async deleteAccount() {
			await client.deleteAccount();
			// La sesión deja de existir; el repositorio volverá a modo local al pasar
			// a anónimo (los datos locales no se tocan).
			set(ANON);
		}
	};
}
