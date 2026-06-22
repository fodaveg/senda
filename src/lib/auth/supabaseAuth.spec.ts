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
	resetPasswordForEmail: vi.fn()
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

import { createSupabaseAuthClient } from './supabaseAuth';

const config = { url: 'https://x.supabase.co', anonKey: 'pk' };
/** Sesión con la forma del SDK (expires_at en segundos). */
const SB_SESSION = { user: { id: 'u1', email: 'a@b.com' }, expires_at: 2 };

beforeEach(() => {
	for (const fn of Object.values(auth)) fn.mockReset();
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
});
