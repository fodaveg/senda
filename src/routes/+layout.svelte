<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/styles/tokens.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ui } from '$lib/i18n';
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

	// Marca el enlace activo en la navegación (cabecera y barra inferior móvil).
	// Para "/" exige coincidencia exacta; para el resto, prefijo de ruta.
	function isActive(path: string): boolean {
		const here = page.url.pathname.replace(/\/$/, '') || '/';
		const target = path.replace(/\/$/, '') || '/';
		return target === '/' ? here === '/' : here === target || here.startsWith(target + '/');
	}

	// Estado del menú "Más" de la barra inferior (móvil).
	let moreOpen = $state(false);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a href="#contenido" class="skip-link">{ui.nav.skipToContent}</a>

<header>
	<a href={resolve('/')} class="brand">{ui.nav.brand}</a>
	<span class="tagline">{ui.nav.tagline}</span>
	<nav class="primary-nav" aria-label="Principal">
		<a href={resolve('/')} class="nav-link" aria-current={isActive('/') ? 'page' : undefined}
			>{ui.nav.discover}</a
		>
		<a
			href={resolve('/diario')}
			class="nav-link"
			aria-current={isActive('/diario') ? 'page' : undefined}>{ui.nav.journal}</a
		>
		{#if auth.enabled}
			<a
				href={resolve('/tendencias')}
				class="nav-link"
				aria-current={isActive('/tendencias') ? 'page' : undefined}>{ui.nav.trends}</a
			>
		{/if}
		<a
			href={resolve('/ajustes')}
			class="nav-link"
			aria-current={isActive('/ajustes') ? 'page' : undefined}>{ui.nav.settings}</a
		>
	</nav>
	<div class="header-right">
		{#if auth.enabled && auth.session}
			<SyncIndicator status={repo.status} />
			<AccountNav session={auth.session} />
		{/if}
		<ThemeToggle />
	</div>
</header>

<main id="contenido">
	{@render children()}
</main>

<footer>
	<span>{ui.footer.data}</span>
	<a href={resolve('/creditos')}>{ui.nav.credits}</a>
</footer>

<!-- Barra de navegación inferior (solo móvil): acceso a las tres áreas
     principales + menú "Más" para el resto. En escritorio queda oculta. -->
<nav class="bottom-nav" aria-label="Navegación móvil">
	<a href={resolve('/')} class="bn-item" aria-current={isActive('/') ? 'page' : undefined}>
		<span class="bn-ic" aria-hidden="true">🧭</span><span class="bn-label">{ui.nav.discover}</span>
	</a>
	<a
		href={resolve('/diario')}
		class="bn-item"
		aria-current={isActive('/diario') ? 'page' : undefined}
	>
		<span class="bn-ic" aria-hidden="true">📔</span><span class="bn-label">{ui.nav.journal}</span>
	</a>
	<a
		href={resolve('/ajustes')}
		class="bn-item"
		aria-current={isActive('/ajustes') ? 'page' : undefined}
	>
		<span class="bn-ic" aria-hidden="true">⚙️</span><span class="bn-label">{ui.nav.settings}</span>
	</a>
	<details class="more" bind:open={moreOpen}>
		<summary class="bn-item">
			<span class="bn-ic" aria-hidden="true">⋯</span><span class="bn-label">{ui.nav.more}</span>
		</summary>
		<div class="more-sheet">
			{#if auth.enabled}
				<a href={resolve('/tendencias')} onclick={() => (moreOpen = false)}>{ui.nav.trends}</a>
				<a href={resolve('/cuenta')} onclick={() => (moreOpen = false)}>{ui.nav.account}</a>
			{/if}
			<a href={resolve('/creditos')} onclick={() => (moreOpen = false)}>{ui.nav.credits}</a>
		</div>
	</details>
</nav>

<style>
	footer {
		max-width: var(--container-wide);
		margin: var(--space-5) auto 0;
		padding: var(--space-3) var(--space-4) var(--space-6);
		border-top: 1px solid var(--border);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		justify-content: space-between;
		align-items: baseline;
		font-size: var(--text-xs);
		color: var(--muted);
	}
	footer a {
		color: var(--brand);
	}
	/* Enlace "saltar al contenido": oculto hasta recibir foco por teclado (a11y). */
	.skip-link {
		position: absolute;
		left: var(--space-2);
		top: -3rem;
		z-index: 100;
		background: var(--surface);
		color: var(--brand);
		border: 1px solid var(--brand);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		font-weight: 600;
		text-decoration: none;
		transition: top 0.15s ease;
	}
	.skip-link:focus {
		top: var(--space-2);
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
		/* La familia tipográfica la fijan los tokens del sistema (tokens.css);
		   aquí solo color/fondo para no competir con la cascada. */
		color: var(--ink);
		background: var(--bg);
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-3) var(--space-4);
		flex-wrap: wrap;
		padding: var(--space-3) var(--space-4);
		background: var(--brand-strong, #1d3a2a);
		color: #fff;
	}
	.brand {
		color: #fff;
		text-decoration: none;
		font-family: var(--font-head);
		font-weight: 800;
		font-size: var(--text-lg);
		letter-spacing: 0.01em;
	}
	.tagline {
		font-size: var(--text-sm);
		color: color-mix(in srgb, #fff 78%, transparent);
		flex: 1;
		min-width: 0;
	}
	.primary-nav {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.header-right {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.nav-link {
		color: color-mix(in srgb, #fff 82%, transparent);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		white-space: nowrap;
	}
	.nav-link:hover {
		color: #fff;
		background: color-mix(in srgb, #fff 14%, transparent);
	}
	.nav-link[aria-current='page'] {
		color: #fff;
		background: color-mix(in srgb, #fff 18%, transparent);
	}
	main {
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-4);
	}

	/* ── Barra inferior móvil ───────────────────────────────────────────── */
	.bottom-nav {
		display: none;
	}
	@media (max-width: 720px) {
		/* La navegación principal se mueve a la barra inferior. */
		.primary-nav {
			display: none;
		}
		.tagline {
			display: none;
		}
		main {
			/* Espacio para que la barra inferior fija no tape el contenido. */
			padding-bottom: calc(64px + var(--space-4));
		}
		footer {
			margin-bottom: 64px;
		}
		.bottom-nav {
			display: flex;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			z-index: 50;
			background: var(--surface);
			border-top: 1px solid var(--border);
			box-shadow: var(--shadow-md);
			padding-bottom: env(safe-area-inset-bottom, 0);
		}
		.bn-item {
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 2px;
			min-height: 56px;
			padding: var(--space-1);
			color: var(--muted);
			text-decoration: none;
			font-size: var(--text-xs);
			font-weight: 600;
			cursor: pointer;
			list-style: none;
		}
		.bn-item::-webkit-details-marker {
			display: none;
		}
		.bn-ic {
			font-size: var(--text-md);
			line-height: 1;
		}
		.bn-item[aria-current='page'] {
			color: var(--brand);
		}
		.more {
			position: relative;
			flex: 1;
			display: flex;
		}
		.more[open] > summary .bn-label {
			color: var(--brand);
		}
		.more-sheet {
			position: absolute;
			bottom: 100%;
			right: var(--space-2);
			margin-bottom: var(--space-2);
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius-md);
			box-shadow: var(--shadow-lg);
			display: flex;
			flex-direction: column;
			min-width: 180px;
			overflow: hidden;
		}
		.more-sheet a {
			padding: var(--space-3) var(--space-4);
			color: var(--ink);
			text-decoration: none;
			font-size: var(--text-sm);
		}
		.more-sheet a:hover {
			background: var(--surface-alt);
		}
	}
</style>
