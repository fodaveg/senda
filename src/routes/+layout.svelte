<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { applyTextScale, loadSettings } from '$lib/settings';
	import { applyAppearance } from '$lib/theme/schemes';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();

	// Marcador para que los tests e2e esperen a la hidratación.
	onMount(() => {
		document.body.dataset.hydrated = 'true';
		applyAppearance(loadSettings());
		applyTextScale(loadSettings().textScale);
		// En modo "auto", seguir los cambios de preferencia del sistema.
		const mq = matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => {
			if (loadSettings().theme === 'auto') applyAppearance(loadSettings());
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<a href={resolve('/')} class="brand">Senderos CV</a>
	<span class="tagline">Senderos homologados FEMECV de la Comunitat Valenciana</span>
	<a href={resolve('/diario')} class="nav-link">Diario</a>
	<a href={resolve('/ajustes')} class="nav-link">Ajustes</a>
	<ThemeToggle />
</header>

<main>
	{@render children()}
</main>

<style>
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
