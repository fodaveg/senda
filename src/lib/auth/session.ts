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
	/**
	 * El usuario llegó desde el enlace de "restablecer contraseña" del correo: la
	 * UI debe pedirle una nueva contraseña antes de seguir (SPECS_V4 §A7).
	 */
	recovery: boolean;
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
	/** Cierra el modo recuperación tras fijar la nueva contraseña. */
	completeRecovery(): void;
}

const ANON: SessionState = { status: 'anonymous', user: null, session: null, recovery: false };

/** Crea el store a partir de un `AuthClient`. Una instancia por sesión de app. */
export function createSessionStore(client: AuthClient): SessionStore {
	const { subscribe, set, update } = writable<SessionState>({
		status: 'loading',
		user: null,
		session: null,
		recovery: false
	});

	function apply(session: Session | null, recovery = false): void {
		set(session ? { status: 'authenticated', user: session.user, session, recovery } : { ...ANON });
	}

	// Detecta el enlace de recuperación de contraseña del correo: el SDK procesa el
	// token de la URL y emite `password_recovery`; activamos el modo recuperación.
	client.onAuthEvent((event) => {
		if (event !== 'password_recovery') return;
		update((s) => ({ ...s, recovery: true }));
		void client
			.currentSession()
			.then((session) => {
				if (session) set({ status: 'authenticated', user: session.user, session, recovery: true });
			})
			.catch(() => {});
	});

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
		},
		completeRecovery() {
			update((s) => ({ ...s, recovery: false }));
		}
	};
}
