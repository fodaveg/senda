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

/**
 * Eventos de autenticación que emite el proveedor. `password_recovery` indica que
 * el usuario llegó desde el enlace de "restablecer contraseña" del correo (el SDK
 * ya estableció una sesión de recuperación): la app debe pedirle la nueva clave.
 */
export type AuthEvent = 'signed_in' | 'signed_out' | 'password_recovery' | 'token_refreshed';

export type AuthErrorKind =
	| 'invalid_credentials'
	| 'email_not_confirmed'
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
	/**
	 * Registra al usuario. Devuelve la sesión si el proveedor inicia sesión al
	 * instante, o `null` si exige **confirmación por correo** antes de poder
	 * entrar (estado válido, no error).
	 */
	signUp(email: string, password: string): Promise<Session | null>;
	signIn(email: string, password: string): Promise<Session>;
	signOut(): Promise<void>;
	currentSession(): Promise<Session | null>;
	requestPasswordReset(email: string): Promise<void>;
	/** Cambia la contraseña del usuario con sesión activa. */
	updatePassword(newPassword: string): Promise<void>;
	/**
	 * OTP opcional (código por correo) para login/verificación reforzada. Necesita
	 * el email al que se envió el código.
	 */
	verifyOtp(email: string, code: string): Promise<Session>;
	/**
	 * Borra la cuenta del usuario con sesión (RGPD / derecho al olvido). Requiere
	 * la RPC `delete_account` desplegada en el servidor (ver `supabase/`); si no
	 * está, el proveedor devuelve error y se propaga como `AuthError`.
	 */
	deleteAccount(): Promise<void>;
	/**
	 * Suscribe a los eventos de auth del proveedor (recuperación de contraseña,
	 * inicio/cierre de sesión, refresco de token). Devuelve la función de baja.
	 */
	onAuthEvent(listener: (event: AuthEvent) => void): () => void;
}
