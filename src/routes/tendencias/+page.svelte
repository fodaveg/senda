<script lang="ts">
	/**
	 * Tendencias (SPECS_V4 §B3/§11): rankings **agregados y anónimos** de rutas
	 * (favoritas/completadas) y material, leídos de las vistas con k-anonimato
	 * (`n >= 5`). Degradación elegante: sin backend, lo dice; con backend pero sin
	 * datos suficientes, muestra un estado vacío (lo normal hasta que haya uso).
	 */
	import { onMount } from 'svelte';
	import { getAnalytics } from '$lib/analytics/context';
	import { routeById } from '$lib/data/routes';
	import type { TrendingGear, TrendingRoute } from '$lib/analytics/types';

	const analytics = getAnalytics();

	let loading = $state(true);
	let failed = $state(false);
	let favoritas = $state<TrendingRoute[]>([]);
	let completadas = $state<TrendingRoute[]>([]);
	let gear = $state<TrendingGear[]>([]);

	function routeName(id: string): string {
		return routeById(id)?.name ?? id;
	}

	onMount(async () => {
		if (!analytics.enabled || !analytics.client) {
			loading = false;
			return;
		}
		try {
			const [routes, materiales] = await Promise.all([
				analytics.client.trendingRoutes(),
				analytics.client.trendingGear()
			]);
			const byN = (a: { n: number }, b: { n: number }) => b.n - a.n;
			favoritas = routes.filter((r) => r.kind === 'favorita').sort(byN);
			completadas = routes.filter((r) => r.kind === 'completada').sort(byN);
			gear = [...materiales].sort(byN);
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	});

	let hasData = $derived(favoritas.length + completadas.length + gear.length > 0);
</script>

<svelte:head><title>Tendencias · Senda</title></svelte:head>

<h1>Tendencias</h1>
<p class="lead">
	Rankings <strong>anónimos y agregados</strong> a partir de lo que la comunidad marca y lleva. Solo aparecen
	cuando hay suficientes datos para no identificar a nadie.
</p>

{#if !analytics.enabled}
	<p class="empty">Las tendencias necesitan la cuenta en la nube, que aún no está activada.</p>
{:else if loading}
	<p class="empty">Cargando tendencias…</p>
{:else if failed}
	<p class="empty">No se pudieron cargar las tendencias ahora mismo. Inténtalo más tarde.</p>
{:else if !hasData}
	<p class="empty">
		Todavía no hay tendencias publicadas. Se mostrarán cuando varias personas hayan marcado las
		mismas rutas o material.
	</p>
{:else}
	<div class="grid">
		{#if favoritas.length > 0}
			<section>
				<h2>Rutas favoritas</h2>
				<ol>
					{#each favoritas as r (r.route_id)}
						<li><span>{routeName(r.route_id)}</span><span class="n">{r.n}</span></li>
					{/each}
				</ol>
			</section>
		{/if}
		{#if completadas.length > 0}
			<section>
				<h2>Rutas más completadas</h2>
				<ol>
					{#each completadas as r (r.route_id)}
						<li><span>{routeName(r.route_id)}</span><span class="n">{r.n}</span></li>
					{/each}
				</ol>
			</section>
		{/if}
		{#if gear.length > 0}
			<section>
				<h2>Material más llevado</h2>
				<ol>
					{#each gear as g (g.name)}
						<li><span>{g.name}</span><span class="n">{g.n}</span></li>
					{/each}
				</ol>
			</section>
		{/if}
	</div>
{/if}

<style>
	.lead {
		color: var(--muted-strong);
		max-width: 42rem;
	}
	.empty {
		color: var(--muted);
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem;
	}
	section {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		background: var(--surface);
	}
	h2 {
		font-size: 1rem;
		margin: 0.25rem 0 0.5rem;
	}
	ol {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.3rem;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.n {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
