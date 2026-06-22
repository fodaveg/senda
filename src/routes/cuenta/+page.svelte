<script lang="ts">
	/**
	 * Página de cuenta (SPECS_V4 §B1/§B5). Si no hay backend configurado, lo dice
	 * y la app sigue siendo plenamente usable en local (la cuenta nunca es
	 * obligatoria). Con backend, delega en AccountPanel, que muestra los
	 * formularios o el backoffice según el estado de sesión.
	 */
	import { getAuth } from '$lib/auth/context';
	import AccountPanel from '$lib/components/AccountPanel.svelte';

	const auth = getAuth();
</script>

<svelte:head>
	<title>Cuenta — Senda</title>
</svelte:head>

<h1>Cuenta</h1>

{#if !auth.enabled || !auth.session || !auth.client}
	<p class="empty">
		La sincronización con cuenta no está disponible en esta instalación. Senda funciona igual al
		100% en local: tus marcas, diario, checklist y material se guardan en este dispositivo.
	</p>
{:else}
	<p class="lead">
		Crear una cuenta es <strong>opcional</strong>: solo añade sincronizar tus datos entre
		dispositivos. Sin cuenta, todo sigue funcionando en local.
	</p>
	<AccountPanel session={auth.session} client={auth.client} />
{/if}

<style>
	.empty,
	.lead {
		color: var(--muted-strong);
		max-width: 40rem;
	}
	.lead {
		margin-bottom: 1.5rem;
	}
</style>
