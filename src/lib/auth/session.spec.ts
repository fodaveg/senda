/**
 * Tests del store de sesión (SPECS_V4 §A3): transiciones de estado y
 * degradación elegante, con un `AuthClient` mockeado (sin red ni SDK).
 */

import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createSessionStore } from './session';
import { AuthError, type AuthClient, type Session } from './types';

const SESSION: Session = { user: { id: 'u1', email: 'a@b.com' }, expiresAt: 1000 };

/** AuthClient falso configurable por test. */
function fakeClient(overrides: Partial<AuthClient> = {}): AuthClient {
	return {
		signUp: vi.fn(async () => SESSION),
		signIn: vi.fn(async () => SESSION),
		signOut: vi.fn(async () => {}),
		currentSession: vi.fn(async () => null),
		requestPasswordReset: vi.fn(async () => {}),
		updatePassword: vi.fn(async () => {}),
		verifyOtp: vi.fn(async () => SESSION),
		...overrides
	};
}

describe('createSessionStore', () => {
	it('arranca en estado loading', () => {
		const store = createSessionStore(fakeClient());
		expect(get(store).status).toBe('loading');
	});

	it('init con sesión persistida → authenticated', async () => {
		const store = createSessionStore(fakeClient({ currentSession: vi.fn(async () => SESSION) }));
		await store.init();
		expect(get(store)).toEqual({ status: 'authenticated', user: SESSION.user, session: SESSION });
	});

	it('init sin sesión → anonymous', async () => {
		const store = createSessionStore(fakeClient());
		await store.init();
		expect(get(store).status).toBe('anonymous');
	});

	it('init que falla por red → anonymous (degradación elegante)', async () => {
		const store = createSessionStore(
			fakeClient({
				currentSession: vi.fn(async () => {
					throw new AuthError('network', 'sin red');
				})
			})
		);
		await store.init();
		expect(get(store).status).toBe('anonymous');
	});

	it('signIn → authenticated con el usuario', async () => {
		const store = createSessionStore(fakeClient());
		await store.signIn('a@b.com', 'pw');
		expect(get(store).user).toEqual(SESSION.user);
	});

	it('signOut → anonymous', async () => {
		const store = createSessionStore(fakeClient({ currentSession: vi.fn(async () => SESSION) }));
		await store.init();
		await store.signOut();
		expect(get(store).status).toBe('anonymous');
	});

	it('signUp con confirmación pendiente (null) no autentica y devuelve null', async () => {
		const store = createSessionStore(fakeClient({ signUp: vi.fn(async () => null) }));
		await store.init();
		const result = await store.signUp('a@b.com', 'pw');
		expect(result).toBeNull();
		expect(get(store).status).toBe('anonymous');
	});

	it('propaga el error de signIn (la UI lo muestra)', async () => {
		const store = createSessionStore(
			fakeClient({
				signIn: vi.fn(async () => {
					throw new AuthError('invalid_credentials', 'mal');
				})
			})
		);
		await expect(store.signIn('a@b.com', 'x')).rejects.toBeInstanceOf(AuthError);
	});
});
