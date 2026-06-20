/**
 * Tipos y contrato del módulo de autenticación (SPECS_V4 §A3). El SDK del
 * proveedor (Supabase) quedará detrás de esta interfaz para no acoplar la app a
 * un backend concreto (portabilidad Cloud ↔ self-host). Sin implementación
 * activa hasta que se configure el backend (coste 0).
 */

export interface AuthUser {
	id: string;
	email: string | null;
}

export interface Session {
	user: AuthUser;
	/** Epoch ms de caducidad del token de acceso. */
	expiresAt: number;
}

export type AuthErrorKind =
	| 'invalid_credentials'
	| 'email_taken'
	| 'rate_limit'
	| 'network'
	| 'unknown';

export class AuthError extends Error {
	constructor(
		public readonly kind: AuthErrorKind,
		message: string
	) {
		super(message);
		this.name = 'AuthError';
	}
}

/** Contrato que implementará el adaptador del proveedor (p. ej. Supabase). */
export interface AuthClient {
	signUp(email: string, password: string): Promise<Session>;
	signIn(email: string, password: string): Promise<Session>;
	signOut(): Promise<void>;
	currentSession(): Promise<Session | null>;
	requestPasswordReset(email: string): Promise<void>;
	/** OTP opcional (TOTP o código por correo) para login reforzado. */
	verifyOtp(code: string): Promise<Session>;
}
