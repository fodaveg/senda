<script lang="ts">
	/**
	 * Enlace de cuenta en la cabecera (SPECS_V4 §B5). Reacciona al estado de
	 * sesión: "Entrar" cuando es anónima, "Cuenta" cuando hay sesión. Recibe el
	 * store como prop (el layout solo lo monta si el backend está habilitado), así
	 * que `$session` siempre opera sobre un store válido.
	 */
	import { resolve } from '$app/paths';
	import type { SessionStore } from '$lib/auth/session';

	let { session }: { session: SessionStore } = $props();
</script>

<a href={resolve('/cuenta')} class="account-link">
	{$session.status === 'authenticated' ? 'Cuenta' : 'Entrar'}
</a>

<style>
	/* Componente hijo: los estilos .nav-link del layout son scoped y no llegan
	   aquí, así que el enlace se estiliza por sí mismo. Va en la barra de marca
	   (verde oscuro, texto blanco): CTA con borde sutil para que destaque del
	   resto de enlaces de navegación sin gritar. */
	.account-link {
		display: inline-flex;
		align-items: center;
		color: #fff;
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		padding: var(--space-2) var(--space-3);
		border: 1px solid color-mix(in srgb, #fff 32%, transparent);
		border-radius: var(--radius-md);
		white-space: nowrap;
	}
	.account-link:hover {
		background: color-mix(in srgb, #fff 14%, transparent);
		border-color: color-mix(in srgb, #fff 55%, transparent);
	}
</style>
