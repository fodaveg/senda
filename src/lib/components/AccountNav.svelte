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

<a href={resolve('/cuenta')} class="nav-link">
	{$session.status === 'authenticated' ? 'Cuenta' : 'Entrar'}
</a>
