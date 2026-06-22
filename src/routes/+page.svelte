<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Map from '$lib/components/LazyMap.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { emptyUserData, isDone, type ToggleMark, type UserData } from '$lib/user/marks';
	import { getUserRepository } from '$lib/user/context';
	import { applyFilters, EMPTY_FILTERS, type RouteFilters } from '$lib/filters';
	import { PROVINCES } from '$lib/geo/province';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import { haversineMeters } from '$lib/geo/distance';
	import { searchRoutes } from '$lib/search';
	import { type OriginSetting } from '$lib/settings';
	import { STATUS_FILTER_OPTIONS, STATUS_LABELS } from '$lib/status';
	import type { RouteType } from '$lib/types';

	const TYPES: RouteType[] = ['GR', 'PR', 'SL'];

	let { data } = $props();
	let routes = $derived(data.routes);

	let filters = $state<RouteFilters>({ ...EMPTY_FILTERS, types: [] });
	let query = $state('');

	// Marcas de usuario como filtro (SPECS_V2 §6/§8).
	const repo = getUserRepository();

	let userData = $state<UserData>(emptyUserData());
	let origin = $state<OriginSetting | null>(null);
	onMount(() => {
		userData = repo.loadMarks();
		origin = repo.loadSettings().origin;
	});
	let sortBy = $state<'nombre' | 'cercania'>('nombre');

	// Mini-ficha flotante al pulsar un pin del mapa (previsualización).
	let preview = $state<(typeof routes)[number] | null>(null);

	// Si el filtro deja fuera la ruta previsualizada, la mini-ficha se cierra.
	$effect(() => {
		if (preview && !filtered.some((r) => r.id === preview!.id)) preview = null;
	});
	let markFilter = $state<ToggleMark | 'hecha' | null>(null);

	let filtered = $derived.by(() => {
		const result = applyFilters(searchRoutes(routes, query), filters).filter((route) => {
			if (markFilter === null) return true;
			const marks = userData.marks[route.id];
			return markFilter === 'hecha' ? isDone(marks) : Boolean(marks?.[markFilter]);
		});
		// Cercanía en línea recta desde el origen habitual (etiquetada así).
		if (sortBy === 'cercania' && origin) {
			const o: [number, number] = [origin.lon, origin.lat];
			return [...result].sort(
				(a, b) =>
					haversineMeters(o, [a.start.lon, a.start.lat]) -
					haversineMeters(o, [b.start.lon, b.start.lat])
			);
		}
		return result;
	});

	/** Botón dado (SPECS_V2 §6): una ruta al azar del resultado actual. */
	function openRandom() {
		if (filtered.length === 0) return;
		const route = filtered[Math.floor(Math.random() * filtered.length)];
		void goto(resolve('/ruta/[id]', { id: route.id }));
	}

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
	<title>Senda — rutas homologadas</title>
</svelte:head>

<h1>Rutas</h1>

<div class="search-row">
	<input
		type="search"
		class="search"
		placeholder="Buscar por nombre, municipio o comarca…"
		aria-label="Buscar rutas"
		bind:value={query}
	/>
	<button
		type="button"
		class="dice"
		title="Abrir una ruta al azar del resultado actual"
		aria-label="Ruta al azar"
		disabled={filtered.length === 0}
		onclick={openRandom}
	>
		🎲
	</button>
</div>

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
	<label>
		Provincia
		<select bind:value={filters.province}>
			<option value={null}>—</option>
			{#each PROVINCES as p (p.id)}
				<option value={p.id}>{p.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Ordenar
		<select bind:value={sortBy}>
			<option value="nombre">por nombre</option>
			<option value="cercania" disabled={origin === null}>
				por cercanía{origin === null ? ' (configura origen)' : ' (línea recta)'}
			</option>
		</select>
	</label>
	<label>
		Marcas
		<select bind:value={markFilter}>
			<option value={null}>—</option>
			<option value="favorita">Favoritas</option>
			<option value="me_gusta">Me gustan</option>
			<option value="quiero_hacer">Quiero hacer</option>
			<option value="hecha">Hechas</option>
		</select>
	</label>
	<label>
		Estado
		<select bind:value={filters.status}>
			<option value={null}>— (sin deshabilitadas)</option>
			{#each STATUS_FILTER_OPTIONS as status (status)}
				<option value={status}>{STATUS_LABELS[status]}</option>
			{/each}
			<option value="todas">Todas (incl. deshabilitadas)</option>
		</select>
	</label>
	<label class="check">
		<input type="checkbox" bind:checked={filters.withWater} /> Con agua
	</label>
	<label class="check">
		<input type="checkbox" bind:checked={filters.highShade} /> Alta sombra
	</label>
</fieldset>

<div class="map-wrap">
	<Map
		{markers}
		bbox={unionBbox}
		onMarkerClick={(id) => (preview = filtered.find((r) => r.id === id) ?? null)}
	/>
	{#if preview}
		<aside class="preview-card" aria-label="Previsualización de ruta">
			<button
				type="button"
				class="preview-close"
				aria-label="Cerrar previsualización"
				onclick={() => (preview = null)}
			>
				×
			</button>
			<p class="preview-head">
				<span class="badge badge-{preview.type.toLowerCase()}">{preview.type}</span>
				<StatusBadge status={preview.status} detail={preview.status_detail} />
			</p>
			<strong class="preview-name">{preview.name}</strong>
			<p class="preview-meta">
				{formatKm(preview.distance_km)}
				{#if preview.ascent_m !== null}· +{formatMeters(preview.ascent_m)}{/if}
				{#if preview.est_duration_min !== null}· {formatDuration(preview.est_duration_min)}{/if}
				{#if preview.circular !== null}· {preview.circular ? 'circular' : 'lineal'}{/if}
			</p>
			{#if preview.municipality}<p class="preview-meta">
					{preview.municipality}{#if preview.zone}
						· {preview.zone}{/if}
				</p>{/if}
			{#if preview.water_points.length > 0}
				<p class="preview-meta">💧 {preview.water_points.length} fuente(s) en ruta</p>
			{/if}
			<a class="preview-link" href={resolve('/ruta/[id]', { id: preview.id })}>Ver ficha →</a>
		</aside>
	{/if}
</div>

<p class="count">{filtered.length} de {routes.length} rutas</p>

<ul class="route-list">
	{#each filtered as route (route.id)}
		<li>
			<a href={resolve('/ruta/[id]', { id: route.id })}>
				<span class="badge badge-{route.type.toLowerCase()}">{route.type}</span>
				<strong>{route.name}</strong>
				<StatusBadge status={route.status} detail={route.status_detail} />
				<span class="meta">
					{formatKm(route.distance_km)}
					{#if route.ascent_m !== null}· +{formatMeters(route.ascent_m)}{/if}
					{#if route.est_duration_min !== null}· {formatDuration(route.est_duration_min)}{/if}
					{#if route.circular !== null}· {route.circular ? 'circular' : 'lineal'}{/if}
					{#if route.municipality}· {route.municipality}{/if}
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.search-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.search {
		flex: 1;
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.dice {
		font-size: 1.3rem;
		padding: 0.2rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		cursor: pointer;
	}
	.dice:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.dice:hover:not(:disabled) {
		border-color: var(--brand);
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 1rem;
		margin-bottom: 1rem;
	}
	.filter-group {
		display: flex;
		gap: 0.75rem;
	}
	.filters .check {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.map-wrap {
		position: relative;
		height: 380px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.preview-card {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		z-index: 5;
		max-width: 20rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		padding: 0.65rem 0.85rem;
	}
	.preview-close {
		position: absolute;
		top: 0.3rem;
		right: 0.45rem;
		border: none;
		background: none;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: 0.1rem 0.3rem;
	}
	.preview-close:hover {
		color: var(--ink);
	}
	.preview-head {
		margin: 0 1.2rem 0.3rem 0;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.preview-name {
		display: block;
		margin-right: 1rem;
	}
	.preview-meta {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.preview-link {
		display: inline-block;
		margin-top: 0.5rem;
		font-weight: 600;
		color: var(--brand);
	}
	.count {
		color: var(--muted);
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
		border: 1px solid var(--border);
		border-radius: 6px;
		text-decoration: none;
		color: inherit;
		background: var(--surface);
	}
	.route-list a:hover {
		border-color: var(--brand);
	}
	.meta {
		color: var(--muted);
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
