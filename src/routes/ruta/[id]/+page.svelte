<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { isTauri } from '@tauri-apps/api/core';
	import BackpackPanel from '$lib/components/BackpackPanel.svelte';
	import StagesList from '$lib/components/StagesList.svelte';
	import { routes } from '$lib/data/routes';
	import { parentOf, stagesOf } from '$lib/data/stages';
	import { PROVINCES, provinceOf } from '$lib/geo/province';
	import { loadMapPrefs, saveMapPrefs } from '$lib/map/prefs';
	import AvisosBanner from '$lib/components/AvisosBanner.svelte';
	import FireRiskCard from '$lib/components/FireRiskCard.svelte';
	import { fetchFireRiskMap, FIRE_RISK_MAX_DAY } from '$lib/weather/fireRisk';
	import RouteMarks from '$lib/components/RouteMarks.svelte';
	import StartWindowCard from '$lib/components/StartWindowCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import Map from '$lib/components/Map.svelte';
	import WeatherCard from '$lib/components/WeatherCard.svelte';
	import { gearItems, gearRules } from '$lib/data/gear';
	import { loadTrackXml } from '$lib/data/tracks';
	import { wildlifeForZone } from '$lib/data/wildlife';
	import {
		evaluateGear,
		evaluateCustomGear,
		ATTRIBUTE_WARNING_RULES,
		waterEstimate,
		energyEstimate
	} from '$lib/engine';
	import { loadCustomGear } from '$lib/user/customGear';
	import type { CustomGearItem } from '$lib/types';
	import { startWindow } from '$lib/engine/startWindow';
	import { gpxToGeoJSON, trackPositions } from '$lib/geo/gpx';
	import { elevationProfile, type ProfilePoint } from '$lib/geo/profile';
	import { fetchDrivingEstimateCached, type DrivingEstimate } from '$lib/geo/routing';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import { loadSettings } from '$lib/settings';
	import { SvelteSet } from 'svelte/reactivity';
	import { loadChecklist, saveChecklist } from '$lib/user/checklist';
	import { wikilocSearchUrl } from '$lib/wikiloc';
	import { deleteByPrefix, getStoredBinary, storeBinary } from '$lib/catalog/store';
	import { ignTileUrl, tileListForBbox, tileStoreKey } from '$lib/map/tiles';
	import {
		AemetAuthError,
		AemetRateLimitError,
		compareForecasts,
		fetchAemetForecastCached,
		type AemetDay
	} from '$lib/weather/aemet';
	import { dateLabel, forecastDates, seasonForDate } from '$lib/weather/dates';
	import { avisosForRoute, fetchAvisosCapCached, type Aviso } from '$lib/weather/avisos';
	import { fetchOpenMeteoHourly, type HourlyPoint } from '$lib/weather/hourly';
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
	let debugMode = $state(false);
	let hourlyByDate = $state<Record<string, HourlyPoint[]>>({});
	let avisos = $state<Aviso[] | null>(null);
	// Riesgo de incendio (AEMET): URL del mapa oficial del día seleccionado.
	let fireRiskMapUrl = $state<string | null>(null);
	let fireRiskLoading = $state(false);
	let travel = $state<{ estimate: DrivingEstimate; from: string } | null>(null);
	// Coordenadas del origen (habitual o GPS) para enlazar indicaciones con
	// punto de partida, no solo destino (SPECS_V3 §7).
	let travelOrigin = $state<{ lat: number; lon: number } | null>(null);
	let checkedItems = new SvelteSet<string>();
	let profileHover = $state<[number, number] | null>(null);
	// Capas de datos sobre el mapa (SPECS_V3 §5): visibles por defecto.
	let showWater = $state(true);
	let showPois = $state(true);
	let offlineTiles = $state<number | null>(null);
	let downloadProgress = $state<string | null>(null);
	let travelStatus = $state<string | null>(null);

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
	// Material propio del usuario (se gestiona en Ajustes): se evalúa y se muestra
	// integrado en la lista de la mochila (SPECS_V3 §4).
	let customItems = $state<CustomGearItem[]>([]);
	let userWeight = $state<number | null>(null);
	// Agua y energía estimadas para el día seleccionado (SPECS_V3.5 §1).
	let hydration = $derived(waterEstimate(route, selectedDay));
	let energy = $derived(energyEstimate(route, userWeight ?? undefined));
	let customDecisions = $derived(
		selectedDate
			? evaluateCustomGear(
					route,
					selectedDay,
					seasonForDate(selectedDate),
					customItems,
					ATTRIBUTE_WARNING_RULES
				)
			: []
	);
	// Ventana ideal de inicio (SPECS_V2 §5): el horario solo afina.
	let window = $derived(startWindow(route, selectedDay, hourlyByDate[selectedDate] ?? null));

	// Relación con otras rutas: etapas (si es una GR multi-día) y padre (si esta
	// ruta es una etapa). Derivado del catálogo, SPECS_V3 §6.
	let stages = $derived(stagesOf(route.id, routes));
	let parent = $derived(parentOf(route.id, routes));
	let provinceLabel = $derived(
		PROVINCES.find((p) => p.id === provinceOf(route.zone))?.label ?? null
	);
	let avisosForDate = $derived(
		avisos && selectedDate ? avisosForRoute(avisos, route.zone, selectedDate) : []
	);

	// Mapa offline (SPECS_V2 §11): ¿hay tiles descargados para esta ruta?
	$effect(() => {
		const r = route;
		void (async () => {
			if (!r.bbox) {
				offlineTiles = null;
				return;
			}
			const first = tileListForBbox(r.bbox)[0];
			offlineTiles = first && (await getStoredBinary(tileStoreKey(first))) ? 1 : 0;
		})();
	});

	async function downloadOfflineMap() {
		if (!route.bbox) return;
		const tiles = tileListForBbox(route.bbox);
		downloadProgress = `Descargando 0/${tiles.length} tiles…`;
		let done = 0;
		try {
			for (const tile of tiles) {
				if ((await getStoredBinary(tileStoreKey(tile))) === null) {
					const response = await fetch(ignTileUrl(tile.z, tile.x, tile.y));
					if (!response.ok) throw new Error(`IGN respondió ${response.status}`);
					await storeBinary(tileStoreKey(tile), await response.arrayBuffer());
				}
				done++;
				if (done % 20 === 0) downloadProgress = `Descargando ${done}/${tiles.length} tiles…`;
			}
			offlineTiles = 1;
			downloadProgress = `Mapa offline listo (${tiles.length} tiles, IGN CC-BY).`;
		} catch (e) {
			console.error('Mapa offline:', e);
			downloadProgress =
				'Descarga interrumpida (sin conexión o IGN caído); reintenta para continuar.';
		}
	}

	async function deleteOfflineMap() {
		const deleted = await deleteByPrefix('tiles/');
		offlineTiles = 0;
		downloadProgress = `Borrados ${deleted} tiles descargados.`;
	}

	// Checklist de preparación por (ruta, fecha) (SPECS_V2 §7).
	$effect(() => {
		if (selectedDate) {
			const stored = loadChecklist(route.id, selectedDate);
			checkedItems.clear();
			for (const id of stored) checkedItems.add(id);
		}
	});

	function toggleChecklistItem(itemId: string) {
		if (checkedItems.has(itemId)) checkedItems.delete(itemId);
		else checkedItems.add(itemId);
		saveChecklist(route.id, selectedDate, new Set(checkedItems));
	}

	// Pronóstico horario por fecha seleccionada, con caché en memoria.
	$effect(() => {
		const date = selectedDate;
		const r = route;
		if (!date || date in hourlyByDate) return;
		void fetchOpenMeteoHourly(r.start.lat, r.start.lon, date)
			.then((points) => {
				hourlyByDate = { ...hourlyByDate, [date]: points };
			})
			.catch((e: unknown) => console.error('Open-Meteo horario:', e));
	});

	// Carga por ruta como $effect (no onMount): se relanza si cambia la ruta
	// sin remontar el componente y relee los ajustes (api key AEMET) en cada
	// visita, de modo que una key recién guardada se usa de inmediato.
	let loadToken = 0;
	$effect(() => {
		void loadRouteData(route, ++loadToken);
	});

	// Mapa de riesgo de incendio (AEMET) para la fecha elegida; se recarga al
	// cambiar de fecha. Requiere api key; degrada en silencio si falla. El
	// offset de día se obtiene de la ventana de fechas (dates[0] = hoy), sin
	// instanciar Date.
	$effect(() => {
		const date = selectedDate;
		const offset = dates.indexOf(date);
		const apiKey = loadSettings().aemetApiKey;
		fireRiskMapUrl = null;
		if (!date || !apiKey || offset < 0 || offset > FIRE_RISK_MAX_DAY) return;
		fireRiskLoading = true;
		let cancelled = false;
		fetchFireRiskMap(apiKey, offset)
			.then((url) => {
				if (!cancelled) fireRiskMapUrl = url;
			})
			.catch((e) => {
				// Sin mapa confirmado no se afirma nada; detalle en consola.
				console.error('AEMET incendios:', e);
			})
			.finally(() => {
				if (!cancelled) fireRiskLoading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	async function loadRouteData(r: typeof route, token: number) {
		const settings = loadSettings();
		userWeight = settings.weightKg;
		customItems = loadCustomGear().items;
		const mapPrefs = loadMapPrefs();
		showWater = mapPrefs.showWater;
		showPois = mapPrefs.showPois;
		debugMode = settings.debugMode;
		geojson = null;
		profile = [];
		trackError = null;
		forecast = null;
		aemetForecast = null;
		aemetNote = null;
		weatherError = null;
		avisos = null;
		hourlyByDate = {};
		travel = null;
		travelOrigin = settings.origin ? { lat: settings.origin.lat, lon: settings.origin.lon } : null;
		travelStatus = null;
		weatherLoading = true;
		const ds = forecastDates();
		dates = ds;
		const requested = page.url.searchParams.get('fecha');
		selectedDate = requested && ds.includes(requested) ? requested : ds[0];
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
		// Tiempo de viaje desde el origen habitual (SPECS_V2 §6).
		if (settings.origin) {
			try {
				const estimate = await fetchDrivingEstimateCached(settings.origin, r.start);
				if (token === loadToken) travel = { estimate, from: settings.origin.label };
			} catch (e) {
				console.error('OSRM:', e);
			}
			if (token !== loadToken) return;
		}
		// Avisos meteorológicos oficiales (SPECS_V2 §5), si hay api key.
		if (settings.aemetApiKey) {
			try {
				const result = await fetchAvisosCapCached(settings.aemetApiKey);
				if (token === loadToken) avisos = result;
			} catch (e) {
				// Sin avisos confirmados no se afirma nada; el detalle queda en consola.
				console.error('AEMET avisos:', e);
			}
		}
		if (token !== loadToken) return;
		// AEMET solo como verificación, si hay api key en ajustes y código de municipio.
		if (settings.aemetApiKey && r.aemet_municipio) {
			try {
				const days = await fetchAemetForecastCached(r.aemet_municipio, settings.aemetApiKey);
				if (token !== loadToken) return;
				aemetForecast = days;
			} catch (e) {
				console.error('AEMET:', e);
				if (token !== loadToken) return;
				aemetForecast = null;
				if (e instanceof AemetAuthError) {
					aemetNote = 'AEMET rechazó la api key: revísala en Ajustes.';
				} else if (e instanceof AemetRateLimitError) {
					aemetNote = 'AEMET ha limitado las peticiones temporalmente; reintenta en unos minutos.';
				} else if (settings.debugMode) {
					aemetNote = `Verificación AEMET no disponible: ${e instanceof Error ? e.message : String(e)}`;
				} else {
					aemetNote = 'Verificación AEMET no disponible ahora mismo.';
				}
			}
		}
	}

	let shareMessage = $state<string | null>(null);

	/** Compartir la ruta con la fecha seleccionada (SPECS_V2 §13). */
	async function shareRoute() {
		shareMessage = null;
		const url = `${location.origin}${location.pathname}?fecha=${selectedDate}`;
		try {
			if (navigator.share) {
				await navigator.share({ title: route.name, url });
				return;
			}
			await navigator.clipboard.writeText(url);
			shareMessage = 'Enlace copiado al portapapeles.';
		} catch {
			shareMessage = url;
		}
	}

	/** GPS solo bajo gesto del usuario (SPECS_V2 §15). */
	function travelFromHere() {
		travelStatus = 'Obteniendo tu posición…';
		if (!('geolocation' in navigator)) {
			travelStatus = 'Este entorno no ofrece geolocalización.';
			return;
		}
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				try {
					const from = { lat: position.coords.latitude, lon: position.coords.longitude };
					travelOrigin = from;
					const estimate = await fetchDrivingEstimateCached(from, route.start);
					travel = { estimate, from: 'tu posición actual' };
					travelStatus = null;
				} catch (e) {
					console.error('OSRM:', e);
					travelStatus = 'No se pudo calcular la ruta en coche (sin conexión u OSRM caído).';
				}
			},
			() => {
				travelStatus = isTauri()
					? 'La app de escritorio no puede acceder a la ubicación del sistema: configura tu ' +
						'"origen habitual" en Ajustes y la estimación aparecerá aquí automáticamente.'
					: 'No se pudo obtener la posición (permiso denegado o sin señal). Alternativa: ' +
						'configura tu "origen habitual" en Ajustes.';
			}
		);
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

<h1>{route.name} <StatusBadge status={route.status} detail={route.status_detail} /></h1>

{#if route.status === 'deshabilitado'}
	<div class="status-banner" role="alert">
		<strong>Ruta deshabilitada por FEMECV</strong> — no recorrer.
		{#if route.status_detail}Estado oficial: "{route.status_detail}".{/if}
	</div>
{:else if route.status === 'con_reservas'}
	<p class="status-note">
		{route.status_detail === 'Control de calidad negativo'
			? 'El último control de calidad fue negativo: la señalización puede ser deficiente.'
			: 'Sin control de calidad reciente: la señalización y el mantenimiento pueden haber variado desde la homologación.'}
	</p>
{/if}

<RouteMarks routeId={route.id} />

<div class="detail-grid">
	<section class="map-col">
		<div class="map-wrap">
			{#if geojson}
				<Map
					track={geojson}
					bbox={route.bbox}
					highlight={profileHover}
					water={route.water_points_geo ?? []}
					pois={route.pois ?? []}
					{showWater}
					{showPois}
				/>
			{:else if trackError}
				<p class="error">No se pudo cargar el track: {trackError}</p>
			{:else}
				<p class="loading">Cargando track…</p>
			{/if}
		</div>

		{#if (route.water_points_geo ?? []).length > 0 || (route.pois ?? []).length > 0}
			<div class="map-toggles no-print">
				{#if (route.water_points_geo ?? []).length > 0}
					<label>
						<input
							type="checkbox"
							bind:checked={showWater}
							onchange={() => saveMapPrefs({ ...loadMapPrefs(), showWater })}
						/>
						💧 Fuentes ({route.water_points_geo.length})
					</label>
				{/if}
				{#if (route.pois ?? []).length > 0}
					<label>
						<input
							type="checkbox"
							bind:checked={showPois}
							onchange={() => saveMapPrefs({ ...loadMapPrefs(), showPois })}
						/>
						📍 Puntos de interés ({route.pois.length})
					</label>
				{/if}
			</div>
		{/if}

		{#if route.bbox}
			<div class="offline-map no-print">
				<button type="button" class="travel-btn" onclick={downloadOfflineMap}>
					{offlineTiles ? 'Actualizar mapa offline' : 'Descargar mapa de esta ruta (IGN)'}
				</button>
				{#if offlineTiles}
					<button type="button" class="travel-btn" onclick={deleteOfflineMap}>
						Borrar tiles descargados
					</button>
				{/if}
				{#if downloadProgress}<span class="travel-hint" role="status">{downloadProgress}</span>{/if}
			</div>
		{/if}

		<h2>Perfil de elevación</h2>
		{#if profile.length > 0 || trackError}
			<ElevationProfile
				points={profile}
				onHover={(index) => {
					profileHover = index === null ? null : [profile[index].lon, profile[index].lat];
				}}
			/>
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
		<AvisosBanner avisos={avisosForDate} />
		<FireRiskCard
			imageUrl={fireRiskMapUrl}
			loading={fireRiskLoading}
			dayLabel={dateLabel(selectedDate)}
		/>
		<WeatherCard
			day={selectedDay}
			loading={weatherLoading}
			aemet={selectedAemet}
			{discrepancies}
			{aemetNote}
			error={debugMode ? weatherDetail : null}
		/>

		<h2>Mejor momento para empezar</h2>
		<StartWindowCard {window} manualHint={route.best_start_time} />

		<h2>Mochila recomendada</h2>
		<BackpackPanel
			{decisions}
			checked={checkedItems}
			onToggle={toggleChecklistItem}
			{customDecisions}
			{hydration}
			{energy}
		/>
	</section>

	<section class="data-col">
		<h2>Datos técnicos</h2>
		<dl>
			{#if route.municipality}
				<dt>Municipio</dt>
				<dd>{route.municipality}</dd>
			{/if}
			{#if provinceLabel}
				<dt>Provincia</dt>
				<dd>{provinceLabel}</dd>
			{/if}
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
			<dd>
				{#if stages.length > 0}
					<a href="#etapas">{route.status_detail ?? route.status}</a>
				{:else}
					{route.status_detail ?? route.status}
				{/if}
			</dd>
			{#if route.best_start_time}
				<dt>Mejor hora de inicio</dt>
				<dd>{route.best_start_time}</dd>
			{/if}
		</dl>

		{#if parent}
			<p class="parent-of">
				Esta ruta es una etapa de
				<a href={resolve('/ruta/[id]', { id: parent.id })}>{parent.name}</a>.
			</p>
		{/if}

		{#if stages.length > 0}
			<section id="etapas" class="stages-section">
				<h3>Etapas <span class="count">({stages.length})</span></h3>
				<p class="stages-hint">Ruta por etapas; cada una es navegable por separado.</p>
				<StagesList {stages} />
			</section>
		{/if}

		<h3>Cómo llegar</h3>
		<div class="travel">
			{#if travel}
				<p>
					En coche desde {travel.from}:
					<strong>{formatDuration(travel.estimate.durationMin)}</strong>
					({formatKm(travel.estimate.distanceKm)}) — estimación OSRM.
				</p>
			{:else}
				<p class="travel-hint">
					Configura tu origen habitual en Ajustes o usa tu posición para estimar el viaje.
				</p>
			{/if}
			<button type="button" class="travel-btn" onclick={travelFromHere}>
				Desde mi posición actual
			</button>
			{#if travelStatus}<p class="travel-hint" role="status">{travelStatus}</p>{/if}
			<p class="travel-hint">
				<a
					href={travelOrigin
						? `https://www.openstreetmap.org/directions?from=${travelOrigin.lat}%2C${travelOrigin.lon}&to=${route.start.lat}%2C${route.start.lon}`
						: `https://www.openstreetmap.org/directions?to=${route.start.lat}%2C${route.start.lon}`}
					rel="external">Indicaciones en OpenStreetMap</a
				>
			</p>
		</div>

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

		<h3>Enlaces</h3>
		<ul>
			{#if route.links.femecv}
				<li><a href={route.links.femecv} rel="external">Ficha FEMECV</a></li>
			{/if}
			{#if route.links.wikiloc}
				<li><a href={route.links.wikiloc} rel="external">Wikiloc (enlace de la ficha)</a></li>
			{/if}
			<li><a href={wikilocSearchUrl(route)} rel="external">Buscar esta ruta en Wikiloc</a></li>
		</ul>

		{#if selectedDate}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- base construida con resolve(); la regla no contempla añadir query string -->
			<a
				class="report-btn"
				href={resolve('/ruta/[id]/informe', { id: route.id }) + `?fecha=${selectedDate}`}
			>
				Generar informe
			</a>
			<a
				class="report-btn emergency-btn"
				href={resolve('/ruta/[id]/emergencia', { id: route.id }) + `?fecha=${selectedDate}`}
			>
				Ficha de emergencia
			</a>
			<button type="button" class="report-btn emergency-btn share-btn" onclick={shareRoute}>
				Compartir
			</button>
			{#if shareMessage}<p class="travel-hint" role="status">{shareMessage}</p>{/if}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}

		<h3>Fuentes</h3>
		<ul class="sources">
			{#each route.sources as source (source)}<li>{source}</li>{/each}
		</ul>
	</section>
</div>

<style>
	.map-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		margin-top: 0.5rem;
		font-size: 0.88rem;
	}
	.map-toggles label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
	}
	.stages-section {
		margin-top: 1rem;
	}
	.stages-section .count {
		font-weight: 400;
		color: var(--muted);
		font-size: 0.85rem;
	}
	.stages-hint {
		font-size: 0.85rem;
		color: var(--muted);
		margin: 0 0 0.5rem;
	}
	.parent-of {
		font-size: 0.9rem;
		margin: 0.5rem 0;
	}
	.offline-map {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.4rem;
	}
	.travel p {
		margin: 0.25rem 0;
	}
	.travel-hint {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.travel-btn {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		border-radius: 6px;
		border: 1px solid var(--brand);
		background: var(--surface);
		color: var(--brand);
		cursor: pointer;
		margin: 0.25rem 0;
	}
	.status-banner {
		border: 1px solid var(--alert-border);
		background: var(--alert-bg);
		color: var(--alert-ink);
		border-radius: 6px;
		padding: 0.6rem 0.9rem;
		margin: 0.5rem 0 1rem;
	}
	.status-note {
		color: #8a5a00;
		font-size: 0.9rem;
		margin: 0.25rem 0 1rem;
	}
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
		border: 1px solid var(--border);
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
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.4rem 0.7rem;
		font-size: 0.8rem;
	}
	.mide strong {
		font-size: 1.2rem;
	}
	.sources {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.other-risks {
		font-size: 0.9rem;
		color: var(--muted);
	}
	.report-btn {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--brand);
		background: var(--brand);
		color: var(--on-brand);
		text-decoration: none;
	}
	.share-btn {
		cursor: pointer;
		font: inherit;
	}
	.emergency-btn {
		background: var(--surface);
		color: var(--brand);
		margin-left: 0.5rem;
	}
	.report-btn:hover {
		opacity: 0.9;
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
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		padding: 0.3rem 0.75rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
	}
	.date-chip.selected {
		background: var(--brand);
		color: var(--on-brand);
		border-color: var(--brand);
	}
	.date-note {
		font-size: 0.78rem;
		color: var(--muted);
		margin: 0.3rem 0 0.6rem;
	}
</style>
