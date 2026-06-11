<script lang="ts">
	import { resolve } from '$app/paths';
	import BackpackPanel from '$lib/components/BackpackPanel.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import Map from '$lib/components/Map.svelte';
	import WeatherCard from '$lib/components/WeatherCard.svelte';
	import { gearItems, gearRules } from '$lib/data/gear';
	import { loadTrackXml } from '$lib/data/tracks';
	import { wildlifeForZone } from '$lib/data/wildlife';
	import { evaluateGear } from '$lib/engine';
	import { gpxToGeoJSON, trackPositions } from '$lib/geo/gpx';
	import { elevationProfile, type ProfilePoint } from '$lib/geo/profile';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import { loadSettings } from '$lib/settings';
	import {
		AemetAuthError,
		compareForecasts,
		fetchAemetForecast,
		type AemetDay
	} from '$lib/weather/aemet';
	import { dateLabel, forecastDates, seasonForDate } from '$lib/weather/dates';
	import { fetchOpenMeteoForecast } from '$lib/weather/openmeteo';
	import type { FeatureCollection } from 'geojson';
	import type { WeatherDay } from '$lib/types';

	let { data } = $props();
	let route = $derived(data.route);
	let wildlife = $derived(wildlifeForZone(route.zone));

	let geojson = $state<FeatureCollection | null>(null);
	let profile = $state<ProfilePoint[]>([]);
	let trackError = $state<string | null>(null);

	// Meteo: hoy + 7 días; sin red la app sigue funcionando (SPEC §4).
	let dates = $state<string[]>([]);
	let selectedDate = $state('');
	let forecast = $state<WeatherDay[] | null>(null);
	let aemetForecast = $state<AemetDay[] | null>(null);
	let aemetNote = $state<string | null>(null);
	let weatherError = $state<string | null>(null);
	let weatherLoading = $state(true);

	let selectedDay = $derived(forecast?.find((d) => d.date === selectedDate) ?? null);
	// Motivo técnico de un panel meteo vacío, para diagnóstico en la UI.
	let weatherDetail = $derived(
		weatherError ??
			(forecast && selectedDate && !selectedDay
				? `El pronóstico recibido no incluye ${selectedDate}; llegó: ${forecast.map((d) => d.date).join(', ') || '(vacío)'}`
				: null)
	);
	let selectedAemet = $derived(aemetForecast?.find((d) => d.date === selectedDate) ?? null);
	let discrepancies = $derived(
		selectedDay && selectedAemet ? compareForecasts(selectedDay, selectedAemet) : []
	);
	let decisions = $derived(
		selectedDate
			? evaluateGear(route, selectedDay, seasonForDate(selectedDate), gearItems, gearRules)
			: []
	);

	// Carga por ruta como $effect (no onMount): se relanza si cambia la ruta
	// sin remontar el componente y relee los ajustes (api key AEMET) en cada
	// visita, de modo que una key recién guardada se usa de inmediato.
	let loadToken = 0;
	$effect(() => {
		void loadRouteData(route, ++loadToken);
	});

	async function loadRouteData(r: typeof route, token: number) {
		geojson = null;
		profile = [];
		trackError = null;
		forecast = null;
		aemetForecast = null;
		aemetNote = null;
		weatherError = null;
		weatherLoading = true;
		const ds = forecastDates();
		dates = ds;
		selectedDate = ds[0];
		try {
			const xml = await loadTrackXml(r.gpx);
			const collection = gpxToGeoJSON(xml);
			if (token !== loadToken) return;
			geojson = collection;
			profile = elevationProfile(trackPositions(collection));
		} catch (e) {
			if (token !== loadToken) return;
			trackError = e instanceof Error ? e.message : String(e);
		}
		try {
			const days = await fetchOpenMeteoForecast(r.start.lat, r.start.lon);
			if (token !== loadToken) return;
			forecast = days;
		} catch (e) {
			// Offline o API caída: panel meteo en estado vacío, nada se rompe,
			// pero el motivo en crudo queda visible para diagnóstico.
			console.error('Open-Meteo:', e);
			if (token !== loadToken) return;
			forecast = null;
			weatherError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
		} finally {
			if (token === loadToken) weatherLoading = false;
		}
		// AEMET solo como verificación, si hay api key en ajustes y código de municipio.
		const { aemetApiKey } = loadSettings();
		if (aemetApiKey && r.aemet_municipio) {
			try {
				const days = await fetchAemetForecast(r.aemet_municipio, aemetApiKey);
				if (token !== loadToken) return;
				aemetForecast = days;
			} catch (e) {
				console.error('AEMET:', e);
				if (token !== loadToken) return;
				aemetForecast = null;
				aemetNote =
					e instanceof AemetAuthError
						? 'AEMET rechazó la api key: revísala en Ajustes.'
						: `Verificación AEMET no disponible: ${e instanceof Error ? e.message : String(e)}`;
			}
		}
	}

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

		<h2>Meteorología prevista</h2>
		{#if dates.length > 0}
			<div class="date-picker" role="group" aria-label="Fecha de la salida">
				{#each dates as date (date)}
					<button
						class="date-chip"
						class:selected={date === selectedDate}
						onclick={() => (selectedDate = date)}
					>
						{dateLabel(date)}
					</button>
				{/each}
			</div>
			<p class="date-note">Pronóstico disponible solo hasta 7 días vista.</p>
		{/if}
		<WeatherCard
			day={selectedDay}
			loading={weatherLoading}
			aemet={selectedAemet}
			{discrepancies}
			{aemetNote}
			error={weatherDetail}
		/>

		<h2>Mochila recomendada</h2>
		<BackpackPanel {decisions} />
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

		{#if wildlife}
			<h3>Fauna y seguridad ({wildlife.name})</h3>
			<ul>
				{#each wildlife.wildlife as w (w.species)}
					<li><strong>{w.species}</strong> (riesgo {w.risk}): {w.advice}</li>
				{/each}
			</ul>
			{#if wildlife.other_risks.length > 0}
				<p class="other-risks">Otros riesgos: {wildlife.other_risks.join('; ')}.</p>
			{/if}
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

		{#if selectedDate}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- base construida con resolve(); la regla no contempla añadir query string -->
			<a
				class="report-btn"
				href={resolve('/ruta/[id]/informe', { id: route.id }) + `?fecha=${selectedDate}`}
			>
				Generar informe
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}

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
	.other-risks {
		font-size: 0.9rem;
		color: #555;
	}
	.report-btn {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid #1d3a2a;
		background: #1d3a2a;
		color: #fff;
		text-decoration: none;
	}
	.report-btn:hover {
		background: #2a5440;
	}
	.loading,
	.error {
		padding: 1rem;
	}
	.error {
		color: #b3261e;
	}
	.date-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.date-chip {
		border: 1px solid #d8d4c8;
		border-radius: 999px;
		background: #fff;
		padding: 0.3rem 0.75rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
	}
	.date-chip.selected {
		background: #1d3a2a;
		color: #fff;
		border-color: #1d3a2a;
	}
	.date-note {
		font-size: 0.78rem;
		color: #555;
		margin: 0.3rem 0 0.6rem;
	}
</style>
