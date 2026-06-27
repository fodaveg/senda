<script lang="ts">
	/**
	 * Panel de cuenta (SPECS_V4 §B1). Con sesión activa muestra el backoffice
	 * (email, cerrar sesión, cambiar contraseña); sin ella, los formularios de
	 * entrar / crear cuenta / recuperar contraseña. Recibe el store de sesión y el
	 * `AuthClient` como props (los provee la página, que ya garantiza que el
	 * backend está habilitado), de modo que el panel no conoce el proveedor.
	 *
	 * Los errores del backend (tipados) se traducen a mensajes en español; nunca
	 * se muestran cadenas crudas del proveedor.
	 */
	import type { SessionStore } from '$lib/auth/session';
	import { AuthError, type AuthClient } from '$lib/auth/types';

	let { session, client }: { session: SessionStore; client: AuthClient } = $props();

	type Mode = 'login' | 'register' | 'reset';
	const SUBMIT_LABEL: Record<Mode, string> = {
		login: 'Entrar',
		register: 'Crear cuenta',
		reset: 'Enviar instrucciones'
	};

	let mode = $state<Mode>('login');
	let email = $state('');
	let password = $state('');
	let newPassword = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	// Borrado de cuenta en dos pasos (evita borrados accidentales).
	let confirmingDelete = $state(false);

	/** Traduce el error tipado del backend a un mensaje claro en español. */
	function messageFor(e: unknown): string {
		if (e instanceof AuthError) {
			switch (e.kind) {
				case 'invalid_credentials':
					return 'Email o contraseña incorrectos.';
				case 'email_not_confirmed':
					return 'Confirma tu correo antes de entrar: te enviamos un enlace al registrarte.';
				case 'email_taken':
					return 'Ese email ya tiene cuenta. Inicia sesión.';
				case 'rate_limit':
					return 'Demasiados intentos. Espera un momento y reinténtalo.';
				case 'network':
					return 'Sin conexión con el servidor. Inténtalo más tarde.';
				default:
					return 'No se pudo completar la operación. Inténtalo de nuevo.';
			}
		}
		return 'Ha ocurrido un error inesperado.';
	}

	function reset() {
		error = null;
		notice = null;
	}

	function switchMode(next: Mode) {
		mode = next;
		reset();
	}

	async function submit() {
		reset();
		busy = true;
		try {
			if (mode === 'login') {
				await session.signIn(email.trim(), password);
			} else if (mode === 'register') {
				const result = await session.signUp(email.trim(), password);
				// null = el proyecto exige confirmar el correo antes de entrar.
				if (!result) notice = 'Te hemos enviado un correo para confirmar la cuenta.';
			} else {
				await client.requestPasswordReset(email.trim());
				notice =
					'Si ese email tiene cuenta, te enviamos instrucciones para restablecer la contraseña.';
			}
			password = '';
		} catch (e) {
			error = messageFor(e);
		} finally {
			busy = false;
		}
	}

	async function changePassword() {
		reset();
		busy = true;
		try {
			await client.updatePassword(newPassword);
			newPassword = '';
			notice = 'Contraseña actualizada.';
		} catch (e) {
			error = messageFor(e);
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		reset();
		busy = true;
		try {
			await session.signOut();
		} catch (e) {
			error = messageFor(e);
		} finally {
			busy = false;
		}
	}

	async function deleteAccount() {
		reset();
		busy = true;
		try {
			await session.deleteAccount();
			confirmingDelete = false;
			// Tras borrar, la sesión pasa a anónima y la app vuelve a modo local con
			// tus datos intactos en este dispositivo.
			notice = 'Cuenta borrada. Tus datos siguen en este dispositivo, solo en local.';
		} catch (e) {
			error = messageFor(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if $session.status === 'authenticated'}
	<section class="panel">
		<h2>Tu cuenta</h2>
		<p class="who">
			Sesión iniciada como <strong>{$session.user?.email ?? 'tu cuenta'}</strong>.
		</p>
		<button type="button" class="secondary" onclick={signOut} disabled={busy}>
			Cerrar sesión
		</button>

		<form
			class="form"
			onsubmit={(e) => {
				e.preventDefault();
				changePassword();
			}}
		>
			<h3>Cambiar contraseña</h3>
			<label>
				Nueva contraseña
				<input
					type="password"
					bind:value={newPassword}
					minlength="6"
					required
					autocomplete="new-password"
				/>
			</label>
			<button type="submit" disabled={busy || newPassword.length < 6}>Cambiar contraseña</button>
		</form>

		<div class="danger">
			<h3>Borrar cuenta</h3>
			<p class="hint">
				Borra tu cuenta y todos tus datos sincronizados en la nube. Lo que tengas en este
				dispositivo se conserva en local. Esta acción no se puede deshacer.
			</p>
			{#if confirmingDelete}
				<p class="confirm-q">¿Seguro que quieres borrar tu cuenta?</p>
				<div class="danger-actions">
					<button type="button" class="danger-btn" onclick={deleteAccount} disabled={busy}>
						Sí, borrar mi cuenta
					</button>
					<button
						type="button"
						class="secondary"
						onclick={() => (confirmingDelete = false)}
						disabled={busy}
					>
						Cancelar
					</button>
				</div>
			{:else}
				<button type="button" class="danger-btn" onclick={() => (confirmingDelete = true)}>
					Borrar cuenta
				</button>
			{/if}
		</div>
	</section>
{:else}
	<section class="panel">
		<div class="tabs" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'login'}
				class:active={mode === 'login'}
				onclick={() => switchMode('login')}
			>
				Entrar
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'register'}
				class:active={mode === 'register'}
				onclick={() => switchMode('register')}
			>
				Crear cuenta
			</button>
		</div>

		<form
			class="form"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<label>
				Email
				<input type="email" bind:value={email} required autocomplete="email" />
			</label>
			{#if mode !== 'reset'}
				<label>
					Contraseña
					<input
						type="password"
						bind:value={password}
						minlength="6"
						required
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					/>
				</label>
			{/if}
			<button type="submit" disabled={busy}>{SUBMIT_LABEL[mode]}</button>
		</form>

		{#if mode === 'login'}
			<button type="button" class="link" onclick={() => switchMode('reset')}>
				¿Olvidaste la contraseña?
			</button>
		{:else if mode === 'reset'}
			<p class="hint">Introduce tu email y te enviaremos un enlace para restablecerla.</p>
			<button type="button" class="link" onclick={() => switchMode('login')}>
				← Volver a entrar
			</button>
		{/if}
	</section>
{/if}

{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if notice}<p class="notice" role="status">{notice}</p>{/if}

<style>
	.panel {
		max-width: 26rem;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.tabs button {
		font: inherit;
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: 6px;
		cursor: pointer;
		color: var(--muted-strong);
	}
	.tabs button.active {
		border-color: var(--brand);
		background: var(--surface-alt);
		color: var(--brand);
		font-weight: 600;
	}
	.form {
		display: grid;
		gap: 0.75rem;
		margin: 1rem 0;
	}
	.form h3 {
		margin: 0;
		font-size: 1rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.9rem;
		font-weight: 600;
	}
	input {
		font: inherit;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--ink);
	}
	button[type='submit'] {
		font: inherit;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--brand);
		background: var(--brand);
		color: var(--on-brand);
		cursor: pointer;
		justify-self: start;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.secondary {
		font: inherit;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--brand);
		background: var(--surface);
		color: var(--brand);
		cursor: pointer;
	}
	.link {
		font: inherit;
		font-size: 0.85rem;
		border: none;
		background: none;
		color: var(--brand);
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}
	.hint {
		font-size: 0.85rem;
		color: var(--muted);
	}
	.error {
		color: var(--alert-ink, #7a1c16);
		background: var(--alert-bg, #fdecea);
		border: 1px solid var(--alert-border, #b3261e);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		max-width: 26rem;
	}
	.notice {
		color: #2a6f4e;
		font-size: 0.9rem;
		max-width: 26rem;
	}
	.danger {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.danger h3 {
		margin: 0 0 0.25rem;
		font-size: 1rem;
		color: var(--alert-border, #b3261e);
	}
	.confirm-q {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.danger-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.danger-btn {
		font: inherit;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--alert-border, #b3261e);
		background: var(--alert-border, #b3261e);
		color: #fff;
		cursor: pointer;
	}
	.danger-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
