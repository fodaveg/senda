<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Marcador para que los tests e2e esperen a la hidratación.
	onMount(() => {
		document.body.dataset.hydrated = 'true';
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<a href={resolve('/')} class="brand">Senderos CV</a>
	<span class="tagline">Senderos homologados FEMECV de la Comunitat Valenciana</span>
</header>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			sans-serif;
		color: #1a1a1a;
		background: #fbfaf7;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		background: #1d3a2a;
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
	}
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem;
	}
</style>
