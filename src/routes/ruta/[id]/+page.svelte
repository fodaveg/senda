<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import Map from '$lib/components/Map.svelte';
	import { loadTrackXml } from '$lib/data/tracks';
	import { gpxToGeoJSON, trackPositions } from '$lib/geo/gpx';
	import { elevationProfile, type ProfilePoint } from '$lib/geo/profile';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import type { FeatureCollection } from 'geojson';

	let { data } = $props();
	let route = $derived(data.route);

	let geojson = $state<FeatureCollection | null>(null);
	let profile = $state<ProfilePoint[]>([]);
	let trackError = $state<string | null>(null);

	onMount(async () => {
		try {
			const xml = await loadTrackXml(route.gpx);
			const collection = gpxToGeoJSON(xml);
			geojson = collection;
			profile = elevationProfile(trackPositions(collection));
		} catch (e) {
			trackError = e instanceof Error ? e.message : String(e);
		}
	});

	const MIDE_LABELS: Record<string, string> = {
		medio: 'Medio',
		itinerario: 'Itinerario',
		desplazamiento: 'Desplazamiento',
		esfuerzo: 'Esfuerzo'
	};
</script>

<svelte:head>
	<title>{route.name} — Senderos CV</title>
</svelte:head>

<nav class="breadcrumb"><a href={resolve('/')}>← Todas las rutas</a></nav>

<h1>{route.name}</h1>

<div class="detail-grid">
	<section class="map-col">
		<div class="map-wrap">
			{#if geojson}
				<Map track={geojson} bbox={route.bbox} />
			{:else if trackError}
				<p class="error">No se pudo cargar el track: {trackError}</p>
			{:else}
				<p class="loading">Cargando track…</p>
			{/if}
		</div>

		<h2>Perfil de elevación</h2>
		{#if profile.length > 0 || trackError}
			<ElevationProfile points={profile} />
		{:else}
			<p class="loading">Cargando perfil…</p>
		{/if}
	</section>

	<section class="data-col">
		<h2>Datos técnicos</h2>
		<dl>
			<dt>Distancia</dt>
			<dd>{formatKm(route.distance_km)}</dd>
			<dt>Desnivel</dt>
			<dd>
				{route.ascent_m !== null ? `+${formatMeters(route.ascent_m)}` : 'sin dato'}
				/
				{route.descent_m !== null ? `−${formatMeters(route.descent_m)}` : 'sin dato'}
			</dd>
			<dt>Tiempo estimado</dt>
			<dd>
				{route.est_duration_min !== null ? formatDuration(route.est_duration_min) : 'sin dato'}
			</dd>
			<dt>Recorrido</dt>
			<dd>{route.circular === null ? 'sin dato' : route.circular ? 'Circular' : 'Lineal'}</dd>
			<dt>Estado</dt>
			<dd>{route.status}</dd>
			{#if route.best_start_time}
				<dt>Mejor hora de inicio</dt>
				<dd>{route.best_start_time}</dd>
			{/if}
		</dl>

		{#if route.difficulty_mide}
			<h3>MIDE</h3>
			<ul class="mide">
				{#each Object.entries(route.difficulty_mide) as [key, value] (key)}
					<li><span>{MIDE_LABELS[key] ?? key}</span><strong>{value}</strong></li>
				{/each}
			</ul>
		{/if}

		{#if route.water_points.length > 0}
			<h3>Fuentes de agua</h3>
			<ul>
				{#each route.water_points as point (point)}<li>{point}</li>{/each}
			</ul>
		{/if}

		{#if route.escape_routes.length > 0}
			<h3>Escapes</h3>
			<ul>
				{#each route.escape_routes as escape (escape)}<li>{escape}</li>{/each}
			</ul>
		{/if}

		{#if route.highlights.length > 0}
			<h3>Puntos destacados</h3>
			<ul>
				{#each route.highlights as highlight (highlight)}<li>{highlight}</li>{/each}
			</ul>
		{/if}

		{#if route.notes_rain}
			<h3>Si llueve</h3>
			<p>{route.notes_rain}</p>
		{/if}

		{#if route.links.femecv || route.links.wikiloc}
			<h3>Enlaces</h3>
			<ul>
				{#if route.links.femecv}
					<li><a href={route.links.femecv} rel="external">Ficha FEMECV</a></li>
				{/if}
				{#if route.links.wikiloc}
					<li><a href={route.links.wikiloc} rel="external">Wikiloc</a></li>
				{/if}
			</ul>
		{/if}

		<button class="report-btn" disabled title="Disponible próximamente">Generar informe</button>

		<h3>Fuentes</h3>
		<ul class="sources">
			{#each route.sources as source (source)}<li>{source}</li>{/each}
		</ul>
	</section>
</div>

<style>
	.breadcrumb {
		margin: 0.5rem 0;
	}
	.detail-grid {
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: 1.5rem;
	}
	@media (max-width: 760px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
	.map-wrap {
		height: 420px;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		overflow: hidden;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.mide {
		list-style: none;
		padding: 0;
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.mide li {
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		padding: 0.4rem 0.7rem;
		font-size: 0.8rem;
	}
	.mide strong {
		font-size: 1.2rem;
	}
	.sources {
		font-size: 0.8rem;
		color: #555;
	}
	.report-btn {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid #1d3a2a;
		background: #e7efe9;
		color: #555;
	}
	.loading,
	.error {
		padding: 1rem;
	}
	.error {
		color: #b3261e;
	}
</style>
