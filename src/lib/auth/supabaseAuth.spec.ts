/**
 * Tests del adaptador Supabase (SPECS_V4 §A3) con el SDK **mockeado**: verifican
 * el mapeo de sesión (segundos→ms, email) y la clasificación tipada de errores,
 * sin red ni proyecto real.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from './types';

// Mock del SDK (hoisted para poder referenciarlo en la factoría de vi.mock).
const auth = vi.hoisted(() => ({
	signInWithPassword: vi.fn(),
	signUp: vi.fn(),
	getSession: vi.fn(),
	signOut: vi.fn(),
	verifyOtp: vi.fn(),
	resetPasswordForEmail: vi.fn(),
	updateUser: vi.fn(),
	onAuthStateChange: vi.fn((cb?: (event: string) => void) => {
		void cb;
		return { data: { subscription: { unsubscribe: vi.fn() } } };
	})
}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth, rpc }) }));

import { createSupabaseAuthClient } from './supabaseAuth';

const config = { url: 'https://x.supabase.co', anonKey: 'pk' };
/** Sesión con la forma del SDK (expires_at en segundos). */
const SB_SESSION = { user: { id: 'u1', email: 'a@b.com' }, expires_at: 2 };

beforeEach(() => {
	for (const fn of Object.values(auth)) fn.mockReset();
	rpc.mockReset();
});

describe('createSupabaseAuthClient', () => {
	it('signIn mapea la sesión (segundos→ms, email)', async () => {
		auth.signInWithPassword.mockResolvedValue({ data: { session: SB_SESSION }, error: null });
		const client = createSupabaseAuthClient(config);
		const session = await client.signIn('a@b.com', 'pw');
		expect(session).toEqual({ user: { id: 'u1', email: 'a@b.com' }, expiresAt: 2000 });
	});

	it('signIn con credenciales inválidas → AuthError invalid_credentials', async () => {
		auth.signInWithPassword.mockResolvedValue({
			data: { session: null },
			error: { message: 'Invalid login credentials', status: 400 }
		});
		const client = createSupabaseAuthClient(config);
		await expect(client.signIn('a@b.com', 'bad')).rejects.toMatchObject({
			kind: 'invalid_credentials'
		});
	});

	it('email sin confirmar → AuthError email_not_confirmed', async () => {
		auth.signInWithPassword.mockResolvedValue({
			data: { session: null },
			error: { message: 'Email not confirmed', status: 400 }
		});
		const client = createSupabaseAuthClient(config);
		await expect(client.signIn('a@b.com', 'pw')).rejects.toMatchObject({
			kind: 'email_not_confirmed'
		});
	});

	it('signUp con confirmación por correo → null', async () => {
		auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
		const client = createSupabaseAuthClient(config);
		await expect(client.signUp('a@b.com', 'pw')).resolves.toBeNull();
	});

	it('signUp con email ya registrado → AuthError email_taken', async () => {
		auth.signUp.mockResolvedValue({
			data: { session: null },
			error: { message: 'User already registered', status: 422 }
		});
		const client = createSupabaseAuthClient(config);
		await expect(client.signUp('a@b.com', 'pw')).rejects.toMatchObject({ kind: 'email_taken' });
	});

	it('status 429 → AuthError rate_limit', async () => {
		auth.signInWithPassword.mockResolvedValue({
			data: { session: null },
			error: { message: 'Too many requests', status: 429 }
		});
		const client = createSupabaseAuthClient(config);
		await expect(client.signIn('a@b.com', 'pw')).rejects.toMatchObject({ kind: 'rate_limit' });
	});

	it('fallo de red (excepción del SDK) → AuthError network', async () => {
		auth.signInWithPassword.mockRejectedValue(new Error('fetch failed'));
		const client = createSupabaseAuthClient(config);
		await expect(client.signIn('a@b.com', 'pw')).rejects.toMatchObject({ kind: 'network' });
	});

	it('currentSession sin sesión → null', async () => {
		auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
		const client = createSupabaseAuthClient(config);
		await expect(client.currentSession()).resolves.toBeNull();
	});

	it('signOut propaga el error del proveedor como AuthError', async () => {
		auth.signOut.mockResolvedValue({ error: { message: 'boom', status: 500 } });
		const client = createSupabaseAuthClient(config);
		await expect(client.signOut()).rejects.toBeInstanceOf(AuthError);
	});

	it('updatePassword llama a updateUser y propaga el error', async () => {
		auth.updateUser.mockResolvedValue({ data: { user: null }, error: null });
		const client = createSupabaseAuthClient(config);
		await client.updatePassword('nuevaclave');
		expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nuevaclave' });

		auth.updateUser.mockResolvedValue({
			data: { user: null },
			error: { message: 'x', status: 401 }
		});
		await expect(client.updatePassword('otra')).rejects.toBeInstanceOf(AuthError);
	});

	it('deleteAccount invoca la RPC delete_account y cierra sesión', async () => {
		rpc.mockResolvedValue({ data: null, error: null });
		auth.signOut.mockResolvedValue({ error: null });
		const client = createSupabaseAuthClient(config);
		await client.deleteAccount();
		expect(rpc).toHaveBeenCalledWith('delete_account');
		expect(auth.signOut).toHaveBeenCalled();
	});

	it('deleteAccount propaga el error de la RPC (p. ej. no desplegada)', async () => {
		rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
		const client = createSupabaseAuthClient(config);
		await expect(client.deleteAccount()).rejects.toBeInstanceOf(AuthError);
	});

	it('onAuthEvent traduce los eventos del SDK y filtra los desconocidos', async () => {
		let sdkCb: (event: string) => void = () => {};
		auth.onAuthStateChange.mockImplementation((cb?: (event: string) => void) => {
			if (cb) sdkCb = cb;
			return { data: { subscription: { unsubscribe: vi.fn() } } };
		});
		const client = createSupabaseAuthClient(config);
		const events: string[] = [];
		const unsub = client.onAuthEvent((e) => events.push(e));
		// La suscripción se monta tras resolver el cliente (import dinámico).
		await new Promise((r) => setTimeout(r, 0));
		sdkCb('PASSWORD_RECOVERY');
		sdkCb('UNKNOWN_EVENT');
		sdkCb('SIGNED_OUT');
		expect(events).toEqual(['password_recovery', 'signed_out']);
		unsub();
	});
});
