<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { applyTextScale } from '$lib/settings';
	import { applyAppearance } from '$lib/theme/schemes';
	import { provideUserRepository } from '$lib/user/context';
	import { SwitchableRepository } from '$lib/user/sessionRepository';
	import { provideAuth } from '$lib/auth/context';
	import { backendConfig } from '$lib/config';
	import { createSupabaseRemoteStore } from '$lib/sync/supabaseRemote';
	import { buildAnalytics, provideAnalytics } from '$lib/analytics/context';
	import { get } from 'svelte/store';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import AccountNav from '$lib/components/AccountNav.svelte';
	import SyncIndicator from '$lib/components/SyncIndicator.svelte';

	let { children } = $props();

	// Repositorio de datos de usuario compartido por toda la app (SPECS_V4 §A1/§B2).
	// Instancia estable y conmutable: local por defecto, sincronizada con la cuenta
	// cuando hay sesión (la fusión local↔remoto es no destructiva, §A6).
	const repo = new SwitchableRepository();
	provideUserRepository(repo);

	// Módulo de auth compartido (SPECS_V4 §A3). Deshabilitado si no hay backend
	// configurado: la app sigue funcionando 100% en local.
	const auth = provideAuth();

	// Analítica anónima opt-in (SPECS_V4 §B3/§11): solo se envía si el usuario dio
	// su consentimiento en Ajustes Y hay sesión iniciada.
	provideAnalytics(
		buildAnalytics({
			canSend: () =>
				repo.loadSettings().analyticsOptIn &&
				(auth.session ? get(auth.session).status === 'authenticated' : false)
		})
	);

	// Marcador para que los tests e2e esperen a la hidratación.
	onMount(() => {
		document.body.dataset.hydrated = 'true';
		// Carga la sesión persistida (si hay backend). Sin red → queda anónima.
		if (auth.enabled) void auth.session?.init();
		// Conmuta el repositorio según la sesión: autenticado → sincroniza con la
		// cuenta; anónimo → modo local (datos intactos). (SPECS_V4 §B2)
		let unsubSession: (() => void) | undefined;
		const config = backendConfig();
		if (auth.enabled && auth.session && config) {
			const remote = createSupabaseRemoteStore(config);
			unsubSession = auth.session.subscribe((s) => {
				if (s.status === 'authenticated') repo.useSynced(remote);
				else if (s.status === 'anonymous') repo.useLocal();
			});
		}
		applyAppearance(repo.loadSettings());
		applyTextScale(repo.loadSettings().textScale);
		// En modo "auto", seguir los cambios de preferencia del sistema.
		const mq = matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => {
			if (repo.loadSettings().theme === 'auto') applyAppearance(repo.loadSettings());
		};
		mq.addEventListener('change', onChange);
		return () => {
			mq.removeEventListener('change', onChange);
			unsubSession?.();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<a href={resolve('/')} class="brand">Senda</a>
	<span class="tagline">Senderos homologados FEMECV de la Comunitat Valenciana</span>
	<a href={resolve('/diario')} class="nav-link">Diario</a>
	{#if auth.enabled}
		<a href={resolve('/tendencias')} class="nav-link">Tendencias</a>
	{/if}
	<a href={resolve('/ajustes')} class="nav-link">Ajustes</a>
	{#if auth.enabled && auth.session}
		<SyncIndicator status={repo.status} />
		<AccountNav session={auth.session} />
	{/if}
	<ThemeToggle />
</header>

<main>
	{@render children()}
</main>

<footer>
	<span> Datos: FEMECV · IGN (CC BY 4.0) · © OpenStreetMap (ODbL) · Open-Meteo/AEMET. </span>
	<a href={resolve('/creditos')}>Créditos y licencias</a>
</footer>

<style>
	footer {
		max-width: 64rem;
		margin: 1rem auto 0;
		padding: 0.75rem 1rem 1.5rem;
		border-top: 1px solid var(--border);
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.8rem;
		color: var(--muted);
	}
	footer a {
		color: var(--brand);
	}
	:global(:root) {
		/* Tema claro (por defecto y "claro forzado" para sol directo). */
		--bg: #fbfaf7;
		--surface: #ffffff;
		--surface-alt: #f4f2ec;
		--border: #d8d4c8;
		--ink: #1a1a1a;
		--muted: #555;
		--muted-strong: #444;
		--brand: #1d3a2a;
		--brand-strong: #1d3a2a;
		--on-brand: #ffffff;
		--alert-bg: #fdecea;
		--alert-border: #b3261e;
		--alert-ink: #7a1c16;
		color-scheme: light;
	}
	/* Fallback de modo oscuro antes de que el JS aplique el esquema (evita
	   flash). En runtime, applyAppearance fija los tokens del esquema elegido. */
	:global(:root[data-theme='oscuro']) {
		--bg: #141815;
		--surface: #1e2420;
		--surface-alt: #262d28;
		--border: #3a423b;
		--ink: #e8e6df;
		--muted: #a9aea5;
		--muted-strong: #c3c8be;
		--brand: #8fd3ae;
		--brand-strong: #18241d;
		--on-brand: #0c1a12;
		--alert-bg: #3a1f1c;
		--alert-border: #f08a82;
		--alert-ink: #ffd9d5;
		color-scheme: dark;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root[data-theme='auto']) {
			--bg: #141815;
			--surface: #1e2420;
			--surface-alt: #262d28;
			--border: #3a423b;
			--ink: #e8e6df;
			--muted: #a9aea5;
			--muted-strong: #c3c8be;
			--brand: #8fd3ae;
			--brand-strong: #18241d;
			--on-brand: #0c1a12;
			--alert-bg: #3a1f1c;
			--alert-border: #f08a82;
			--alert-ink: #ffd9d5;
			color-scheme: dark;
		}
	}
	:global(*),
	:global(*::before),
	:global(*::after) {
		/* El padding y el borde cuentan dentro del ancho declarado: evita que
		   inputs y tarjetas se desborden de su contenedor. */
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			sans-serif;
		color: var(--ink);
		background: var(--bg);
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		background: var(--brand-strong, #1d3a2a);
		color: #fff;
	}
	.brand {
		color: #fff;
		text-decoration: none;
		font-weight: 700;
		font-size: 1.2rem;
	}
	.tagline {
		font-size: 0.85rem;
		color: #cfe3d6;
		flex: 1;
	}
	.nav-link {
		color: #cfe3d6;
		font-size: 0.9rem;
	}
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem;
	}
</style>
