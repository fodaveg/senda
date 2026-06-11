<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Map from '$lib/components/Map.svelte';
	import { applyFilters, EMPTY_FILTERS, type RouteFilters } from '$lib/filters';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import type { RouteType } from '$lib/types';

	const TYPES: RouteType[] = ['GR', 'PR', 'SL'];

	let { data } = $props();
	let routes = $derived(data.routes);

	let filters = $state<RouteFilters>({ ...EMPTY_FILTERS, types: [] });

	let filtered = $derived(applyFilters(routes, filters));

	let markers = $derived(
		filtered.map((r) => ({ id: r.id, lat: r.start.lat, lon: r.start.lon, name: r.name }))
	);

	let unionBbox = $derived.by((): [number, number, number, number] | null => {
		const boxes = filtered.map((r) => r.bbox).filter((b) => b !== null);
		if (boxes.length === 0) return null;
		return boxes.reduce((acc, b) => [
			Math.min(acc[0], b[0]),
			Math.min(acc[1], b[1]),
			Math.max(acc[2], b[2]),
			Math.max(acc[3], b[3])
		]);
	});

	function toggleType(type: RouteType) {
		filters.types = filters.types.includes(type)
			? filters.types.filter((t) => t !== type)
			: [...filters.types, type];
	}
</script>

<svelte:head>
	<title>Senderos CV — rutas homologadas</title>
</svelte:head>

<h1>Rutas</h1>

<fieldset class="filters">
	<legend>Filtros</legend>
	<div class="filter-group" role="group" aria-label="Tipo de sendero">
		{#each TYPES as type (type)}
			<label>
				<input
					type="checkbox"
					checked={filters.types.includes(type)}
					onchange={() => toggleType(type)}
				/>
				{type}
			</label>
		{/each}
	</div>
	<label>
		Distancia máx.
		<select bind:value={filters.maxDistanceKm}>
			<option value={null}>—</option>
			<option value={5}>5 km</option>
			<option value={10}>10 km</option>
			<option value={15}>15 km</option>
			<option value={25}>25 km</option>
		</select>
	</label>
	<label>
		Desnivel máx.
		<select bind:value={filters.maxAscentM}>
			<option value={null}>—</option>
			<option value={300}>300 m</option>
			<option value={600}>600 m</option>
			<option value={1000}>1000 m</option>
		</select>
	</label>
	<label>
		Recorrido
		<select bind:value={filters.circular}>
			<option value={null}>—</option>
			<option value={true}>Circular</option>
			<option value={false}>Lineal</option>
		</select>
	</label>
</fieldset>

<div class="map-wrap">
	<Map {markers} bbox={unionBbox} onMarkerClick={(id) => goto(resolve('/ruta/[id]', { id }))} />
</div>

<p class="count">{filtered.length} de {routes.length} rutas</p>

<ul class="route-list">
	{#each filtered as route (route.id)}
		<li>
			<a href={resolve('/ruta/[id]', { id: route.id })}>
				<span class="badge badge-{route.type.toLowerCase()}">{route.type}</span>
				<strong>{route.name}</strong>
				<span class="meta">
					{formatKm(route.distance_km)}
					{#if route.ascent_m !== null}· +{formatMeters(route.ascent_m)}{/if}
					{#if route.est_duration_min !== null}· {formatDuration(route.est_duration_min)}{/if}
					{#if route.circular !== null}· {route.circular ? 'circular' : 'lineal'}{/if}
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		padding: 0.5rem 1rem;
		margin-bottom: 1rem;
	}
	.filter-group {
		display: flex;
		gap: 0.75rem;
	}
	.map-wrap {
		height: 380px;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		overflow: hidden;
	}
	.count {
		color: #555;
		font-size: 0.9rem;
	}
	.route-list {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.route-list a {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.65rem 0.85rem;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		text-decoration: none;
		color: inherit;
		background: #fff;
	}
	.route-list a:hover {
		border-color: #1d3a2a;
	}
	.meta {
		color: #555;
		font-size: 0.9rem;
	}
	.badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		color: #fff;
	}
	.badge-gr {
		background: #b3261e;
	}
	.badge-pr {
		background: #b8860b;
	}
	.badge-sl {
		background: #2a6f4e;
	}
</style>
