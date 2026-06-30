<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { isTauri } from '@tauri-apps/api/core';
	import BackpackPanel from '$lib/components/BackpackPanel.svelte';
	import { Banner, FeatureGuard, Skeleton, TypeBadge } from '$lib/components/ui';
	import { federationInfo, routeCapabilities } from '$lib/data/federation';
	import StagesList from '$lib/components/StagesList.svelte';
	import { routes } from '$lib/data/routes';
	import { parentOf, stagesOf } from '$lib/data/stages';
	import { linkedRoutes } from '$lib/data/links';
	import { PROVINCES, provinceOf } from '$lib/geo/province';
	import { loadMapPrefs, saveMapPrefs } from '$lib/map/prefs';
	import { loadFichaLayout, saveFichaLayout, type FichaLayout } from '$lib/ficha/layoutPref';
	import { loadWaypoints, saveWaypoints, makeWaypoint, type Waypoint } from '$lib/user/waypoints';
	import AvisosBanner from '$lib/components/AvisosBanner.svelte';
	import FireRiskCard from '$lib/components/FireRiskCard.svelte';
	import { fetchFireRiskMap, FIRE_RISK_MAX_DAY } from '$lib/weather/fireRisk';
	import RouteMarks from '$lib/components/RouteMarks.svelte';
	import StartWindowCard from '$lib/components/StartWindowCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import Map from '$lib/components/LazyMap.svelte';
	import LiveTracking from '$lib/components/LiveTracking.svelte';
	import WeatherCard from '$lib/components/WeatherCard.svelte';
	import { gearItems, gearRules } from '$lib/data/gear';
	import { loadTrackXml } from '$lib/data/tracks';
	import { wildlifeForZone, wildlifeEmoji } from '$lib/data/wildlife';
	import {
		evaluateGear,
		evaluateCustomGear,
		ATTRIBUTE_WARNING_RULES,
		waterEstimate,
		energyEstimate
	} from '$lib/engine';
	import type { CustomGearItem } from '$lib/types';
	import { liveCustomItems } from '$lib/user/customGear';
	import { startWindow } from '$lib/engine/startWindow';
	import { gpxToGeoJSON, trackPositions } from '$lib/geo/gpx';
	import { elevationProfile, type ProfilePoint } from '$lib/geo/profile';
	import { fetchDrivingEstimateCached, type DrivingEstimate } from '$lib/geo/routing';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import { SvelteSet } from 'svelte/reactivity';
	import { getUserRepository } from '$lib/user/context';
	import { wikilocSearchUrl } from '$lib/wikiloc';
	import { deleteByPrefix, getStoredBinary } from '$lib/catalog/store';
	import { tileListForBbox, tileStoreKey } from '$lib/map/tiles';
	import { downloadTilesForBbox } from '$lib/map/offline';
	import {
		AemetAuthError,
		AemetRateLimitError,
		compareForecasts,
		fetchAemetForecastCached,
		type AemetDay
	} from '$lib/weather/aemet';
	import { bestForecastDay, dateLabel, forecastDates, seasonForDate } from '$lib/weather/dates';
	import { avisosForRoute, fetchAvisosCapCached, type Aviso } from '$lib/weather/avisos';
	import { fetchOpenMeteoHourly, type HourlyPoint } from '$lib/weather/hourly';
	import { fetchOpenMeteoForecast } from '$lib/weather/openmeteo';
	import { glanceCondition } from '$lib/weather/condition';
	import type { FeatureCollection } from 'geojson';
	import type { WeatherDay } from '$lib/types';

	let { data } = $props();
	const repo = getUserRepository();
	let route = $derived(data.route);
	let wildlife = $derived(wildlifeForZone(route.zone));
	// Multi-federación (V5-1): qué publica la fuente oficial de esta ruta, para
	// pintar guardas en los bloques que no expone. FEMECV/CV las tiene todas.
	let caps = $derived(routeCapabilities(route));
	let fedLabel = $derived(federationInfo(route.federacion).label);

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
	// Waypoints propios (SPECS_V3.5 §3).
	let waypoints = $state<Waypoint[]>([]);
	let addWaypointMode = $state(false);

	function onMapClick(lngLat: { lat: number; lon: number }) {
		if (!addWaypointMode) return;
		waypoints = [...waypoints, makeWaypoint(lngLat.lat, lngLat.lon, 'Punto')];
		saveWaypoints(route.id, waypoints);
	}
	function updateWaypointNote(id: string, note: string) {
		waypoints = waypoints.map((w) => (w.id === id ? { ...w, note } : w));
		saveWaypoints(route.id, waypoints);
	}
	function removeWaypoint(id: string) {
		waypoints = waypoints.filter((w) => w.id !== id);
		saveWaypoints(route.id, waypoints);
	}
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
	// Rutas que enlazan por proximidad de extremos (SPECS_V3.5 §5).
	let links = $derived(linkedRoutes(route, routes));
	let provinceLabel = $derived(
		PROVINCES.find((p) => p.id === provinceOf(route.zone))?.label ?? null
	);
	// Mejor día previsto para esta ruta (SPECS_V3.5 §5).
	let bestDay = $derived(bestForecastDay(forecast ?? []));
	// Posiciones del track para "en ruta" (SPECS_V3.5 §6).
	let trackPos = $derived(geojson ? trackPositions(geojson) : []);
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
		downloadProgress = 'Descargando mapa…';
		try {
			const total = await downloadTilesForBbox(route.bbox, (done, t) => {
				if (done % 20 === 0 || done === t) downloadProgress = `Descargando ${done}/${t} tiles…`;
			});
			offlineTiles = 1;
			downloadProgress = `Mapa offline listo (${total} tiles, IGN CC-BY).`;
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
			const stored = repo.loadChecklist(route.id, selectedDate);
			checkedItems.clear();
			for (const id of stored) checkedItems.add(id);
		}
	});

	function toggleChecklistItem(itemId: string) {
		if (checkedItems.has(itemId)) checkedItems.delete(itemId);
		else checkedItems.add(itemId);
		repo.saveChecklist(route.id, selectedDate, new Set(checkedItems));
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
		const apiKey = repo.loadSettings().aemetApiKey;
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
		const settings = repo.loadSettings();
		userWeight = settings.weightKg;
		customItems = liveCustomItems(repo.loadCustomGear());
		const mapPrefs = loadMapPrefs();
		showWater = mapPrefs.showWater;
		showPois = mapPrefs.showPois;
		fichaLayout = loadFichaLayout();
		waypoints = loadWaypoints(r.id);
		addWaypointMode = false;
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

	// ── Navegación interna de la ficha (v6, variante B + pestañas móvil) ──────
	// Tablero modular: índice lateral pegajoso en escritorio (todas las secciones
	// apiladas y visibles) y pestañas que conmutan el panel en móvil.
	const FICHA_SECTIONS = [
		{ id: 'resumen', label: 'Resumen', icon: '📋' },
		{ id: 'mapa', label: 'Mapa y perfil', icon: '🗺️' },
		{ id: 'preparacion', label: 'Preparación', icon: '🎒' },
		{ id: 'seguridad', label: 'Condiciones y seguridad', icon: '⚠️' },
		{ id: 'meteo', label: 'Meteo', icon: '🌤️' },
		{ id: 'acciones', label: 'Acciones', icon: '⚡' },
		{ id: 'comunidad', label: 'Comunidad', icon: '💬' }
	];
	let activeSection = $state('resumen');
	// Disposición de la ficha (persistida): 'tabs' (defecto) o 'board' (tablero
	// modular en escritorio). Ver $lib/ficha/layoutPref.
	let fichaLayout = $state<FichaLayout>('tabs');
	function setLayout(layout: FichaLayout) {
		fichaLayout = layout;
		saveFichaLayout(layout);
	}
	function goToSection(id: string) {
		activeSection = id;
		// En escritorio las secciones están apiladas → desplaza a su ancla; en
		// móvil basta con conmutar el panel visible (lo hace data-active vía CSS).
		// Respeta "reducir movimiento" (a11y): sin animación si así se pide.
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		document
			.getElementById(`sec-${id}`)
			?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
	}

	// Recomendación de decisión del día (panel Resumen). Heurística ligera que
	// SOLO presenta datos ya existentes (estado FEMECV, avisos, pronóstico); no
	// inventa nada. Sin pronóstico → no se muestra (degradación elegante).
	let recommendation = $derived.by(() => {
		if (route.status === 'deshabilitado')
			return {
				tone: 'alert' as const,
				label: 'No recomendado',
				reason: 'Ruta deshabilitada por FEMECV.'
			};
		if (avisosForDate.length > 0)
			return {
				tone: 'warn' as const,
				label: 'Precaución',
				reason: 'Hay avisos meteorológicos vigentes para la fecha elegida.'
			};
		if (selectedDay && selectedDay.precipitation_probability_max >= 60)
			return {
				tone: 'warn' as const,
				label: 'Precaución',
				reason: 'Alta probabilidad de lluvia para la fecha elegida.'
			};
		if (selectedDay)
			return {
				tone: 'ok' as const,
				label: 'Adelante',
				reason: 'Sin avisos y buena previsión para la fecha elegida.'
			};
		return null;
	});

	// Estados posibles de la recomendación, en orden de severidad, para pintar la
	// "escala" de chips bajo la tarjeta (el activo es el de `recommendation.tone`).
	const RECO_STATES = [
		{ tone: 'ok' as const, label: 'Adelante' },
		{ tone: 'warn' as const, label: 'Precaución' },
		{ tone: 'alert' as const, label: 'No recomendado' }
	];

	// Condición meteo "de un vistazo" derivada de la probabilidad de lluvia del día
	// elegido (el pronóstico no trae estado de cielo; ver $lib/weather/condition).
	let glance = $derived(selectedDay ? glanceCondition(selectedDay) : null);
	// Primeros 3 días para la mini-tarjeta de meteo en Condiciones.
	let conditionDays = $derived((forecast ?? []).slice(0, 3));

	// Progreso de la mochila para la tarjeta-resumen "Mochila X/Y": ítems
	// recomendados ("Llevar") y cuántos lleva ya marcados el usuario.
	let packItems = $derived(decisions.filter((d) => d.status === 'enabled'));
	let packChecked = $derived(packItems.filter((d) => checkedItems.has(d.item.id)).length);
	let packPct = $derived(
		packItems.length > 0 ? Math.round((packChecked / packItems.length) * 100) : 0
	);
</script>

<svelte:head>
	<title>{route.name} — Senda</title>
</svelte:head>

<nav class="breadcrumb"><a href={resolve('/')}>← Todas las rutas</a></nav>

<!-- Cabecera "banco de preparación" (handoff v6): resumen + acciones de la ruta.
     Badge de tipo + estado + fuente, nombre, métricas clave y acciones. La
     primaria futura "Iniciar ruta" (navegación en vivo, móvil) queda reservada
     y deshabilitada. -->
<header class="ficha-head">
	<div class="fh-row">
		<div class="fh-main">
			<div class="fh-tags">
				<TypeBadge type={route.type} />
				<StatusBadge status={route.status} detail={route.status_detail} />
				<span class="fh-source">{fedLabel}</span>
			</div>

			<h1>{route.name}</h1>

			<dl class="fh-metrics">
				<div>
					<dt>Distancia</dt>
					<dd>{formatKm(route.distance_km)}</dd>
				</div>
				<div>
					<dt>Desnivel</dt>
					<dd>
						{route.ascent_m !== null ? `+${formatMeters(route.ascent_m)}` : 'sin dato'}
						{#if route.descent_m !== null}<span class="fh-desc"
								>−{formatMeters(route.descent_m)}</span
							>{/if}
					</dd>
				</div>
				<div>
					<dt>Duración</dt>
					<dd>
						{route.est_duration_min !== null ? formatDuration(route.est_duration_min) : 'sin dato'}
					</dd>
				</div>
				<div>
					<dt>Forma</dt>
					<dd>{route.circular === null ? 'sin dato' : route.circular ? 'Circular' : 'Lineal'}</dd>
				</div>
			</dl>
		</div>

		<div class="fh-aside">
			<div class="fh-actions">
				<RouteMarks routeId={route.id} compact />
				<!-- eslint-disable svelte/no-navigation-without-resolve -- base construida con resolve(); la regla no contempla añadir query string -->
				<a
					class="fh-btn"
					href={resolve('/ruta/[id]/emergencia', { id: route.id }) + `?fecha=${selectedDate}`}
				>
					🆘 Ficha de emergencia
				</a>
				<a
					class="fh-btn fh-primary"
					href={resolve('/ruta/[id]/informe', { id: route.id }) + `?fecha=${selectedDate}`}
				>
					📄 Generar informe
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
			<p class="fh-reserved-hint" title="Navegación en vivo — próximamente (móvil)">
				⚠ «Iniciar ruta» — reservado para móvil (futuro)
			</p>
		</div>
	</div>

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
</header>

<div class="ficha-toolbar">
	<div class="seg" role="group" aria-label="Disposición de la ficha">
		<button
			type="button"
			class:active={fichaLayout === 'tabs'}
			aria-pressed={fichaLayout === 'tabs'}
			onclick={() => setLayout('tabs')}>Pestañas</button
		>
		<button
			type="button"
			class:active={fichaLayout === 'board'}
			aria-pressed={fichaLayout === 'board'}
			onclick={() => setLayout('board')}>Tablero</button
		>
	</div>
</div>

<div class="ficha" data-layout={fichaLayout}>
	<!-- Índice de secciones: tira de pestañas (defecto) o, en 'board' y escritorio,
	     índice lateral pegajoso con todas las secciones apiladas. -->
	<nav class="ficha-index" aria-label="Secciones de la ruta">
		{#each FICHA_SECTIONS as s (s.id)}
			<button
				type="button"
				class="fi-item"
				class:active={activeSection === s.id}
				aria-current={activeSection === s.id ? 'page' : undefined}
				onclick={() => goToSection(s.id)}
			>
				<span class="fi-ic" aria-hidden="true">{s.icon}</span><span class="fi-label">{s.label}</span
				>
			</button>
		{/each}
	</nav>

	<div class="ficha-panels">
		<!-- ── Resumen: panel de decisión ──────────────────────────────────── -->
		<section
			id="sec-resumen"
			class="fsec"
			data-active={activeSection === 'resumen'}
			aria-label="Resumen"
		>
			<h2 class="fsec-title">Resumen</h2>

			<!-- Recomendación del día como tarjeta con escala de chips de estado
			     (Adelante · Precaución · No recomendado). Solo presenta datos ya
			     existentes (estado FEMECV, avisos, pronóstico); no inventa nada. -->
			{#if recommendation}
				<div
					class="reco"
					data-tone={recommendation.tone}
					role={recommendation.tone === 'alert' ? 'alert' : 'status'}
				>
					<span class="reco-ic" aria-hidden="true">
						{recommendation.tone === 'alert' ? '🔴' : recommendation.tone === 'warn' ? '⚠️' : '✅'}
					</span>
					<div class="reco-body">
						<div class="reco-top">
							<span class="reco-badge">{recommendation.label}</span>
							<span class="reco-kicker">Recomendación de hoy</span>
						</div>
						<p class="reco-reason">{recommendation.reason}</p>
						<div class="reco-chips">
							{#each RECO_STATES as st (st.tone)}
								<span class="reco-chip" class:active={st.tone === recommendation.tone}
									>{st.label}</span
								>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<div class="resumen-grid">
				<!-- Columna ancha: meteo de un vistazo, ventana ideal y acceso. -->
				<div class="rg-col">
					<div class="card glance-card">
						<div class="card-head">
							<h3 class="card-title">
								Meteo de un vistazo · {selectedDate === dates[0] ? 'Hoy' : dateLabel(selectedDate)}
							</h3>
							<button type="button" class="card-link" onclick={() => goToSection('meteo')}
								>Ver completa →</button
							>
						</div>
						{#if selectedDay && glance}
							<div class="glance-grid">
								<div class="glance-item">
									<div class="glance-ic" aria-hidden="true">{glance.icon}</div>
									<div class="glance-cap">{glance.label}</div>
								</div>
								<div class="glance-item">
									<div class="glance-val">
										{Math.round(selectedDay.temperature_2m_max)}°
										<span class="muted">/ {Math.round(selectedDay.temperature_2m_min)}°</span>
									</div>
									<div class="glance-cap">Máx / mín</div>
								</div>
								<div class="glance-item">
									<div class="glance-val">
										{Math.round(selectedDay.precipitation_probability_max)}%
									</div>
									<div class="glance-cap">Prob. lluvia</div>
								</div>
								<div class="glance-item">
									<div class="glance-val">
										{Math.round(selectedDay.wind_speed_10m_max)} <span class="unit">km/h</span>
									</div>
									<div class="glance-cap">Viento</div>
								</div>
							</div>
							<p class="card-foot">
								Pronóstico {selectedDay.source === 'aemet' ? 'AEMET' : 'Open-Meteo'} para {dateLabel(
									selectedDate
								)}.
							</p>
						{:else if weatherLoading}
							<Skeleton shape="block" height="64px" />
						{:else}
							<p class="card-foot">
								Sin pronóstico disponible ahora mismo (sin conexión o API caída).
							</p>
						{/if}
					</div>

					<div class="card">
						<h3 class="card-title">Mejor momento para empezar</h3>
						<StartWindowCard {window} day={selectedDay} manualHint={route.best_start_time} />
					</div>

					<div class="card">
						<h3 class="card-title">Cómo llegar al inicio</h3>
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
					</div>
				</div>

				<!-- Columna estrecha: avisos, incendio, datos clave y mochila. Avisos y
				     riesgo de incendio son RESÚMENES compactos que enlazan al detalle
				     completo en "Condiciones y seguridad" (no se duplican aquí). -->
				<div class="rg-col">
					<div class="card" data-alert={avisosForDate.length > 0 ? 'on' : undefined}>
						<div class="card-kicker">Avisos AEMET / CAP</div>
						{#if avisosForDate.length > 0}
							<p class="aviso-line">
								<strong
									>{avisosForDate.length}
									{avisosForDate.length > 1 ? 'avisos vigentes' : 'aviso vigente'}</strong
								>
								— {avisosForDate[0].event} (aviso {avisosForDate[0].level}).
							</p>
							<button type="button" class="card-link" onclick={() => goToSection('seguridad')}
								>Ver detalle →</button
							>
						{:else}
							<p class="card-foot">
								{#if avisos === null}
									Configura la API key de AEMET en Ajustes para ver avisos oficiales.
								{:else}
									Sin avisos de lluvia, nieve, viento o tormenta vigentes para la fecha elegida.
								{/if}
							</p>
						{/if}
					</div>

					<div class="card">
						<div class="card-kicker">Riesgo de incendio forestal</div>
						{#if fireRiskLoading}
							<p class="card-foot">Consultando el mapa de riesgo de AEMET…</p>
						{:else if fireRiskMapUrl}
							<p class="card-foot">
								Mapa oficial de AEMET disponible para {dateLabel(selectedDate)}.
							</p>
							<button type="button" class="card-link" onclick={() => goToSection('seguridad')}
								>Ver mapa →</button
							>
						{:else}
							<p class="card-foot">
								El mapa oficial de AEMET aparece en Condiciones (requiere API key en Ajustes).
							</p>
						{/if}
					</div>

					<div class="card">
						<div class="card-kicker">Datos clave</div>
						<dl class="key-data">
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
							<dt>Duración</dt>
							<dd>
								{route.est_duration_min !== null
									? formatDuration(route.est_duration_min)
									: 'sin dato'}
							</dd>
							<dt>Recorrido</dt>
							<dd>
								{route.circular === null ? 'sin dato' : route.circular ? 'Circular' : 'Lineal'}
							</dd>
							<dt>Estado</dt>
							<dd>
								{#if stages.length > 0}
									<a href="#etapas">{route.status_detail ?? route.status}</a>
								{:else}
									{route.status_detail ?? route.status}
								{/if}
							</dd>
							{#if route.best_start_time}
								<dt>Mejor hora</dt>
								<dd>{route.best_start_time}</dd>
							{/if}
							<dt>Fuente</dt>
							<dd>{fedLabel}</dd>
						</dl>
					</div>

					{#if packItems.length > 0}
						<div class="pack-card">
							<div class="pack-head">
								<span class="pack-title">Mochila</span>
								<span class="pack-count">{packChecked} / {packItems.length}</span>
							</div>
							<div
								class="pack-bar"
								role="progressbar"
								aria-valuenow={packChecked}
								aria-valuemin="0"
								aria-valuemax={packItems.length}
							>
								<div class="pack-fill" style:width={`${packPct}%`}></div>
							</div>
							<button type="button" class="pack-btn" onclick={() => goToSection('preparacion')}
								>Ir a Preparación →</button
							>
						</div>
					{/if}
				</div>
			</div>

			<div class="resumen-extra">
				{#if parent}
					<p class="parent-of">
						Esta ruta es una etapa de
						<a href={resolve('/ruta/[id]', { id: parent.id })}>{parent.name}</a>.
					</p>
				{/if}

				<!-- MIDE en caja de widget (handoff: cuatro valores Medio/Itinerario/
				     Desplazamiento/Esfuerzo). -->
				{#if !caps.mide}
					<div class="card">
						<h3 class="card-title">MIDE</h3>
						<FeatureGuard federacion={fedLabel} feature="la valoración MIDE" />
					</div>
				{:else if route.difficulty_mide}
					<div class="card">
						<h3 class="card-title">MIDE</h3>
						<ul class="mide">
							{#each Object.entries(route.difficulty_mide) as [key, value] (key)}
								<li><span>{MIDE_LABELS[key] ?? key}</span><strong>{value}</strong></li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if route.highlights.length > 0}
					<div class="card">
						<h3 class="card-title">Puntos destacados</h3>
						<ul class="highlights">
							{#each route.highlights as highlight (highlight)}<li>{highlight}</li>{/each}
						</ul>
					</div>
				{/if}

				<!-- Comunidad al final: función futura, sin dato real (no FEMECV). -->
				<div class="community-strip">
					<span class="cs-tag">Comunidad — sin verificar</span>
					<span class="cs-text">
						Partes de estado de otros senderistas —
						<button type="button" class="link-btn" onclick={() => goToSection('comunidad')}
							>función futura</button
						>, aún sin reportes reales.
					</span>
				</div>
			</div>
		</section>

		<!-- ── Mapa y perfil ───────────────────────────────────────────────── -->
		<section
			id="sec-mapa"
			class="fsec"
			data-active={activeSection === 'mapa'}
			aria-label="Mapa y perfil"
		>
			<h2 class="fsec-title">Mapa y perfil</h2>
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
						{waypoints}
						{onMapClick}
					/>
				{:else if trackError}
					<p class="error">No se pudo cargar el track: {trackError}</p>
				{:else}
					<Skeleton shape="block" height="100%" />
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

			{#if geojson}
				<div class="waypoints-tool no-print">
					<button
						type="button"
						class="travel-btn"
						class:active={addWaypointMode}
						aria-pressed={addWaypointMode}
						onclick={() => (addWaypointMode = !addWaypointMode)}
					>
						📍 {addWaypointMode ? 'Toca el mapa para añadir (terminar)' : 'Añadir punto propio'}
					</button>
					{#if waypoints.length > 0}
						<ul class="waypoint-list">
							{#each waypoints as wp (wp.id)}
								<li>
									<input
										type="text"
										value={wp.note}
										aria-label="Nota del punto"
										onchange={(e) =>
											updateWaypointNote(wp.id, (e.currentTarget as HTMLInputElement).value)}
									/>
									<button
										type="button"
										class="wp-remove"
										aria-label={`Quitar punto ${wp.note}`}
										onclick={() => removeWaypoint(wp.id)}>×</button
									>
								</li>
							{/each}
						</ul>
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
					{#if downloadProgress}<span class="travel-hint" role="status">{downloadProgress}</span
						>{/if}
				</div>
			{/if}

			{#if geojson}
				<LiveTracking {trackPos} sunsetIso={selectedDay?.sunset ?? null} routeName={route.name} />
			{/if}

			<h3>Perfil de elevación</h3>
			{#if profile.length > 0 || trackError}
				<ElevationProfile
					points={profile}
					onHover={(index) => {
						profileHover = index === null ? null : [profile[index].lon, profile[index].lat];
					}}
				/>
			{:else}
				<Skeleton shape="block" height="120px" />
			{/if}
		</section>

		<!-- ── Preparación ─────────────────────────────────────────────────── -->
		<section
			id="sec-preparacion"
			class="fsec"
			data-active={activeSection === 'preparacion'}
			aria-label="Preparación"
		>
			<h2 class="fsec-title">Preparación</h2>

			<h3>Mochila recomendada</h3>
			<BackpackPanel
				{decisions}
				checked={checkedItems}
				onToggle={toggleChecklistItem}
				{customDecisions}
				{hydration}
				{energy}
			/>

			{#if !caps.agua}
				<h3>Fuentes de agua</h3>
				<FeatureGuard federacion={fedLabel} feature="los puntos de agua" />
			{:else if route.water_points.length > 0}
				<h3>Fuentes de agua</h3>
				<ul>
					{#each route.water_points as point (point)}<li>{point}</li>{/each}
				</ul>
			{/if}

			{#if stages.length > 0}
				<section id="etapas" class="stages-section">
					<h3>Etapas <span class="count">({stages.length})</span></h3>
					<p class="stages-hint">Ruta por etapas; cada una es navegable por separado.</p>
					<StagesList {stages} />
				</section>
			{/if}

			{#if links.length > 0}
				<section class="stages-section">
					<h3>Enlaza con <span class="count">({links.length})</span></h3>
					<p class="stages-hint">Rutas cuyo inicio o fin está cerca del de esta (encadenables).</p>
					<ul class="links-list">
						{#each links as l (l.id)}
							<li><a href={resolve('/ruta/[id]', { id: l.id })}>{l.name}</a></li>
						{/each}
					</ul>
				</section>
			{/if}
		</section>

		<!-- ── Condiciones y seguridad ─────────────────────────────────────── -->
		<section
			id="sec-seguridad"
			class="fsec"
			data-active={activeSection === 'seguridad'}
			aria-label="Condiciones y seguridad"
		>
			<h2 class="fsec-title">Condiciones y seguridad</h2>

			<div class="cond-grid">
				<!-- Izquierda: resumen meteo, avisos y riesgo de incendio. -->
				<div class="rg-col">
					{#if conditionDays.length > 0}
						<div class="card">
							<div class="card-head">
								<h3 class="card-title">Meteo</h3>
								<button type="button" class="card-link" onclick={() => goToSection('meteo')}
									>Por días y horas →</button
								>
							</div>
							<div class="mini-meteo">
								{#each conditionDays as d (d.date)}
									{@const g = glanceCondition(d)}
									<div class="mm-day" class:rainy={d.precipitation_probability_max >= 60}>
										<div class="mm-label">{dateLabel(d.date)}</div>
										<div class="mm-ic" aria-hidden="true">{g.icon}</div>
										<div class="mm-temp">
											{Math.round(d.temperature_2m_max)}°
											<span class="muted">/ {Math.round(d.temperature_2m_min)}°</span>
										</div>
										<div class="mm-rain">Lluvia {Math.round(d.precipitation_probability_max)}%</div>
									</div>
								{/each}
							</div>
							<p class="card-foot">
								Pronóstico {conditionDays[0].source === 'aemet' ? 'AEMET' : 'Open-Meteo'}; el icono
								se deriva de la probabilidad de lluvia.
							</p>
						</div>
					{/if}

					{#if avisosForDate.length > 0}
						<AvisosBanner avisos={avisosForDate} />
					{:else}
						<div class="card">
							<div class="card-kicker">Avisos AEMET / CAP vigentes</div>
							<p class="card-foot">
								{#if avisos === null}
									Configura la API key de AEMET en Ajustes para ver avisos oficiales.
								{:else}
									Sin avisos de lluvia, nieve, viento o tormenta vigentes para la fecha elegida.
								{/if}
							</p>
						</div>
					{/if}

					<FireRiskCard
						imageUrl={fireRiskMapUrl}
						loading={fireRiskLoading}
						dayLabel={dateLabel(selectedDate)}
					/>
				</div>

				<!-- Derecha: fauna, escapes y emergencias 112. -->
				<div class="rg-col">
					{#if !caps.fauna}
						<div class="card">
							<div class="card-kicker">Fauna de la zona</div>
							<FeatureGuard federacion={fedLabel} feature="datos de fauna y riesgos" />
						</div>
					{:else if wildlife}
						<div class="card">
							<div class="fauna-head">
								<h3 class="card-title">Fauna de la zona</h3>
								<span class="tag-orient">Orientativo</span>
							</div>
							<ul class="fauna-list">
								{#each wildlife.wildlife as w (w.species)}
									<li>
										<span class="fauna-ic" aria-hidden="true">{wildlifeEmoji(w.species)}</span>
										<div>
											<strong>{w.species}</strong>
											<span class="muted">(riesgo {w.risk}) — {w.advice}</span>
										</div>
									</li>
								{/each}
							</ul>
							{#if wildlife.other_risks.length > 0}
								<p class="other-risks">Otros riesgos: {wildlife.other_risks.join('; ')}.</p>
							{/if}
							<p class="card-foot">
								Lista no exhaustiva ({wildlife.name}). Fuente: {wildlife.sources.join(', ')}.
							</p>
						</div>
					{/if}

					{#if !caps.escapes}
						<div class="card">
							<div class="card-kicker">Rutas de escape</div>
							<FeatureGuard federacion={fedLabel} feature="rutas de escape" />
						</div>
					{:else if route.escape_routes.length > 0}
						<div class="card">
							<h3 class="card-title">Rutas de escape</h3>
							<ul class="escape-list">
								{#each route.escape_routes as escape, i (escape)}
									<li>
										<span class="escape-badge" aria-hidden="true"
											>{String.fromCharCode(65 + i)}</span
										>
										<span>{escape}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if route.notes_rain}
						<div class="card">
							<h3 class="card-title">Si llueve</h3>
							<p class="rain-note">{route.notes_rain}</p>
						</div>
					{/if}

					<!-- eslint-disable svelte/no-navigation-without-resolve -- base con resolve() + query string -->
					<div class="emergency-card">
						<div class="ec-head">
							<span class="ec-ic" aria-hidden="true">🆘</span>
							<div>
								<div class="ec-title">Emergencias · 112</div>
								<div class="ec-sub">
									Lleva el móvil cargado: la cobertura puede ser irregular en montaña.
								</div>
							</div>
						</div>
						<a
							class="ec-btn"
							href={resolve('/ruta/[id]/emergencia', { id: route.id }) + `?fecha=${selectedDate}`}
						>
							Abrir ficha de emergencia
						</a>
					</div>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
			</div>
		</section>

		<!-- ── Meteo ───────────────────────────────────────────────────────── -->
		<section id="sec-meteo" class="fsec" data-active={activeSection === 'meteo'} aria-label="Meteo">
			<h2 class="fsec-title">Meteorología prevista</h2>
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
				{#if bestDay && bestDay !== selectedDate}
					<p class="best-day">
						Mejor día previsto: <strong>{dateLabel(bestDay)}</strong>
						<button type="button" class="link-btn" onclick={() => (selectedDate = bestDay)}
							>elegir</button
						>
					</p>
				{/if}
				<p class="date-note">Pronóstico disponible solo hasta 7 días vista.</p>
			{/if}
			<WeatherCard
				day={selectedDay}
				loading={weatherLoading}
				aemet={selectedAemet}
				{discrepancies}
				{aemetNote}
				error={debugMode ? weatherDetail : null}
			/>
		</section>

		<!-- ── Acciones ────────────────────────────────────────────────────── -->
		<section
			id="sec-acciones"
			class="fsec"
			data-active={activeSection === 'acciones'}
			aria-label="Acciones"
		>
			<h2 class="fsec-title">Acciones</h2>

			{#if selectedDate}
				<div class="actions-row">
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
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
				{#if shareMessage}<p class="travel-hint" role="status">{shareMessage}</p>{/if}
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

			<h3>Fuentes</h3>
			<ul class="sources">
				{#each route.sources as source (source)}<li>{source}</li>{/each}
			</ul>
		</section>

		<!-- ── Comunidad (función futura, sin verificar) ───────────────────── -->
		<section
			id="sec-comunidad"
			class="fsec"
			data-active={activeSection === 'comunidad'}
			aria-label="Comunidad"
		>
			<h2 class="fsec-title">Comunidad</h2>
			<Banner tone="info" icon="💬" title="Reportes de la comunidad — sin verificar">
				Próximamente: partes de estado, valoraciones y fotos de otros senderistas. Esta información
				no procede de FEMECV y se mostrará siempre claramente etiquetada como sin verificar.
			</Banner>
		</section>
	</div>
</div>

<style>
	.map-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		margin-top: 0.5rem;
		font-size: 0.88rem;
	}
	.waypoints-tool {
		margin-top: 0.5rem;
	}
	.travel-btn.active {
		background: var(--brand);
		color: var(--on-brand);
	}
	.waypoint-list {
		list-style: none;
		padding: 0;
		margin: 0.4rem 0 0;
		display: grid;
		gap: 0.3rem;
	}
	.waypoint-list li {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.waypoint-list input {
		flex: 1;
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		background: var(--surface);
		color: var(--ink);
	}
	.wp-remove {
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 1.1rem;
		cursor: pointer;
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
	.links-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.25rem;
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
		color: var(--warn);
		font-size: 0.9rem;
		margin: 0.25rem 0 1rem;
	}
	.breadcrumb {
		margin: 0.5rem 0;
	}
	/* Cabecera-tarjeta "banco de preparación": info a la izquierda, acciones a la
	   derecha en escritorio; apila en una columna al envolver. */
	.ficha-head {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(40, 38, 30, 0.08));
		margin-bottom: var(--space-4);
	}
	.fh-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-3) var(--space-4);
	}
	.fh-main {
		flex: 1 1 320px;
		min-width: 0;
	}
	.ficha-head h1 {
		font-size: var(--text-2xl);
		margin: var(--space-1) 0 var(--space-3);
	}
	.fh-tags {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.fh-source {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	/* Métricas clave en fila (envuelven en pantallas estrechas / escala 1.6×). */
	.fh-metrics {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		margin: 0;
	}
	.fh-metrics > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.fh-metrics dt {
		font-size: var(--text-xs);
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.fh-metrics dd {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 700;
		font-family: var(--font-head);
	}
	.fh-desc {
		color: var(--muted);
		font-weight: 600;
		font-size: var(--text-md);
		margin-left: var(--space-1);
	}
	.fh-aside {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.fh-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-2);
	}
	.fh-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-sm);
		font-weight: 600;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink);
		text-decoration: none;
		cursor: pointer;
		min-height: 40px;
	}
	.fh-btn:hover {
		background: var(--surface-alt);
	}
	/* "Generar informe": acción primaria del diseño (verde de marca). */
	.fh-primary {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--on-brand);
	}
	.fh-primary:hover {
		background: var(--brand);
		opacity: 0.92;
	}
	/* "Iniciar ruta": acción primaria futura, reservada como nota discreta. */
	.fh-reserved-hint {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--muted);
		border: 1px dashed var(--border);
		border-radius: var(--radius-pill, 999px);
		padding: var(--space-1) var(--space-3);
	}
	/* Conmutador de disposición (segmented control), alineado a la derecha. */
	.ficha-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-3);
	}
	.seg {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: var(--radius-pill, 999px);
	}
	.seg button {
		border: none;
		background: transparent;
		color: var(--muted-strong, var(--muted));
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill, 999px);
		cursor: pointer;
		min-height: 32px;
	}
	.seg button.active {
		background: var(--surface);
		color: var(--brand);
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(40, 38, 30, 0.12));
	}

	/* ── Disposición de la ficha ──────────────────────────────────────────────
	   Base = 'tabs' (todos los anchos): tira de pestañas pegajosa + solo la
	   sección activa visible. 'board' es una mejora de escritorio (más abajo). */
	.ficha {
		display: block;
	}
	.ficha-index {
		position: sticky;
		top: calc(var(--space-3) + 52px); /* bajo el dock flotante de la cabecera */
		z-index: 10;
		display: flex;
		flex-direction: row;
		overflow-x: auto;
		gap: 2px;
		background: var(--bg);
		padding: var(--space-2) 0;
		margin-bottom: var(--space-4);
		border-bottom: 1px solid var(--border);
		scrollbar-width: thin;
	}
	.fi-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
		text-align: left;
		padding: var(--space-2) var(--space-3);
		border: none;
		background: transparent;
		color: var(--muted-strong, var(--muted));
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		border-radius: var(--radius-md);
		cursor: pointer;
		min-height: 40px;
	}
	.fi-item:hover {
		background: var(--surface-alt);
		color: var(--ink);
	}
	.fi-item.active {
		background: var(--brand-soft);
		color: var(--brand);
	}
	.fi-ic {
		font-size: var(--text-md);
		line-height: 1;
	}
	.ficha-panels {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-width: 0;
	}
	.fsec {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		scroll-margin-top: calc(var(--space-3) + 112px); /* dock + tira de pestañas */
	}
	/* Pestañas: solo se ve la sección activa (las demás siguen en el DOM). */
	.fsec[data-active='false'] {
		display: none;
	}
	.fsec-title {
		font-size: var(--text-xl);
		font-weight: 700;
		margin: 0 0 var(--space-3);
	}
	.fsec h3 {
		font-size: var(--text-md);
		margin: var(--space-4) 0 var(--space-2);
	}
	.fsec h3:first-of-type {
		margin-top: var(--space-2);
	}
	.actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	/* En móvil las pestañas se compactan (icono sobre etiqueta) y se oculta el
	   conmutador: ahí la ficha es siempre 'tabs' (un rail lateral no cabe). */
	@media (max-width: 720px) {
		.ficha-toolbar {
			display: none;
		}
		.fi-item {
			flex-direction: column;
			gap: 2px;
			font-size: var(--text-xs);
			text-align: center;
		}
	}

	/* 'board' (escritorio): índice lateral pegajoso + todas las secciones
	   apiladas y visibles a la vez. */
	@media (min-width: 721px) {
		.ficha[data-layout='board'] {
			display: grid;
			grid-template-columns: 232px minmax(0, 1fr);
			gap: var(--space-5);
			align-items: start;
		}
		.ficha[data-layout='board'] .ficha-index {
			flex-direction: column;
			overflow: visible;
			background: transparent;
			border-bottom: none;
			margin-bottom: 0;
			padding: 0;
		}
		.ficha[data-layout='board'] .fsec[data-active='false'] {
			display: block;
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
	}
	.report-btn:hover {
		opacity: 0.9;
	}
	.error {
		padding: 1rem;
		color: var(--danger);
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
	.best-day {
		font-size: 0.85rem;
		margin: 0.25rem 0 0;
	}
	.link-btn {
		font: inherit;
		font-size: 0.85rem;
		background: none;
		border: none;
		color: var(--brand);
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}
	.date-note {
		font-size: 0.78rem;
		color: var(--muted);
		margin: 0.3rem 0 0.6rem;
	}

	/* ── Resumen v6: tarjeta de recomendación + rejilla 2 columnas ──────────── */
	.reco {
		--reco-color: var(--ok);
		--reco-soft: var(--ok-soft);
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		flex-wrap: wrap;
		border: 1px solid color-mix(in srgb, var(--reco-color) 45%, transparent);
		background: var(--reco-soft);
		border-radius: var(--radius-lg);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-4);
	}
	.reco[data-tone='warn'] {
		--reco-color: var(--warn);
		--reco-soft: var(--warn-soft);
	}
	.reco[data-tone='alert'] {
		--reco-color: var(--danger);
		--reco-soft: var(--danger-soft);
	}
	.reco-ic {
		font-size: var(--text-xl);
		line-height: 1;
		flex: none;
	}
	.reco-body {
		flex: 1 1 240px;
		min-width: 0;
	}
	.reco-top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.reco-badge {
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--on-brand);
		background: var(--reco-color);
		padding: 2px 10px;
		border-radius: var(--radius-pill, 999px);
	}
	.reco-kicker {
		font-size: var(--text-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}
	.reco-reason {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
		line-height: 1.5;
	}
	.reco-chips {
		margin-top: var(--space-3);
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.reco-chip {
		font-size: var(--text-xs);
		font-weight: 700;
		padding: 3px 10px;
		border-radius: var(--radius-pill, 999px);
		background: var(--surface);
		color: var(--muted);
		opacity: 0.6;
	}
	.reco-chip.active {
		opacity: 1;
		font-weight: 800;
		background: var(--reco-color);
		color: var(--on-brand);
	}

	.resumen-grid {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: var(--space-4);
		align-items: start;
	}
	.rg-col {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	/* Tarjeta genérica del resumen (las que no traen marco propio). */
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-4);
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(40, 38, 30, 0.06));
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.fsec .card-title {
		font-size: var(--text-base, 1rem);
		font-weight: 700;
		margin: 0 0 var(--space-2);
	}
	.fsec .card-head .card-title {
		margin: 0;
	}
	.card-link {
		border: none;
		background: transparent;
		color: var(--brand);
		font: inherit;
		font-size: var(--text-xs);
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}
	.card-kicker {
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: var(--space-2);
	}
	.card-foot {
		margin: var(--space-3) 0 0;
		font-size: var(--text-xs);
		color: var(--muted);
		line-height: 1.5;
	}
	/* Resumen de avisos con tinte de alerta cuando hay alguno vigente. */
	.card[data-alert='on'] {
		background: var(--alert-soft);
		border-color: color-mix(in srgb, var(--danger) 40%, transparent);
	}
	.aviso-line {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
		line-height: 1.45;
	}
	.aviso-line + .card-link,
	.card-foot + .card-link {
		margin-top: var(--space-2);
		display: inline-block;
	}
	/* Meteo de un vistazo: 4 métricas en fila que envuelven. */
	.glance-grid {
		margin-top: var(--space-3);
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.glance-item {
		flex: 1 1 80px;
	}
	.glance-ic {
		font-size: 28px;
		line-height: 1;
	}
	.glance-val {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: var(--text-lg);
	}
	.glance-val .muted,
	.glance-item .muted {
		color: var(--muted);
		font-weight: 600;
	}
	.glance-val .unit {
		font-size: var(--text-sm);
		color: var(--muted);
		font-weight: 600;
	}
	.glance-cap {
		margin-top: 4px;
		font-size: var(--text-xs);
		color: var(--muted);
		font-weight: 600;
	}
	/* Datos clave: filas etiqueta ↔ valor (valor alineado a la derecha). */
	.key-data {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-3);
		align-items: baseline;
		font-size: var(--text-sm);
	}
	.key-data dt {
		color: var(--muted);
		font-weight: 400;
	}
	.key-data dd {
		font-weight: 700;
		text-align: right;
	}
	/* Tarjeta Mochila X/Y con barra de progreso y atajo a Preparación. */
	.pack-card {
		background: var(--brand-soft);
		border: 1px solid var(--brand-line);
		border-radius: var(--radius-md);
		padding: var(--space-4);
	}
	.pack-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.pack-title {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: var(--text-base, 1rem);
	}
	.pack-count {
		font-weight: 700;
		font-size: var(--text-sm);
		color: var(--brand);
	}
	.pack-bar {
		margin-top: var(--space-2);
		height: 8px;
		border-radius: var(--radius-pill, 999px);
		background: var(--surface);
		overflow: hidden;
	}
	.pack-fill {
		height: 100%;
		background: var(--brand);
	}
	.pack-btn {
		margin-top: var(--space-3);
		width: 100%;
		padding: var(--space-2);
		border: none;
		border-radius: var(--radius-md);
		background: var(--brand);
		color: var(--on-brand);
		font: inherit;
		font-weight: 700;
		font-size: var(--text-sm);
		cursor: pointer;
	}
	/* Tira de comunidad (función futura, sin dato real). */
	/* Cola del Resumen (parent, MIDE en caja, destacados, comunidad al final). */
	.resumen-extra {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.resumen-extra .parent-of {
		margin: 0;
	}
	.highlights {
		margin: var(--space-2) 0 0;
		padding-left: 1.2rem;
	}
	.community-strip {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
		background: var(--warn-soft);
		border: 1px dashed color-mix(in srgb, var(--warn) 50%, transparent);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
	}
	.cs-tag {
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--warn);
		flex: none;
	}
	.cs-text {
		font-size: var(--text-sm);
		flex: 1 1 200px;
		min-width: 0;
	}
	/* ── Condiciones y seguridad v6: rejilla 2 columnas ────────────────────── */
	.cond-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		align-items: start;
	}
	/* Mini-meteo de 3 días: el día lluvioso se tiñe de alerta. */
	.mini-meteo {
		margin-top: var(--space-3);
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.mm-day {
		flex: 1 1 80px;
		text-align: center;
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}
	.mm-day.rainy {
		background: var(--alert-soft);
		border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
	}
	.mm-label {
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--muted);
	}
	.mm-ic {
		font-size: 22px;
		line-height: 1.2;
		margin: 2px 0;
	}
	.mm-temp {
		font-weight: 700;
		font-size: var(--text-sm);
	}
	.mm-temp .muted {
		color: var(--muted);
		font-weight: 600;
	}
	.mm-rain {
		margin-top: 4px;
		font-size: var(--text-xs);
		color: var(--muted);
	}
	/* Fauna: encabezado con badge "Orientativo" + lista con icono por especie. */
	.fauna-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.tag-orient {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: var(--radius-pill, 999px);
		background: var(--warn-soft);
		color: var(--warn);
	}
	.fauna-list {
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}
	.fauna-list li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.fauna-ic {
		flex: none;
	}
	/* Escapes: lista con marcador circular A/B. */
	.escape-list {
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}
	.escape-list li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.escape-badge {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: var(--text-xs);
		background: var(--ok-soft);
		color: var(--ok);
	}
	.rain-note {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
		line-height: 1.5;
	}
	/* Tarjeta de emergencias 112: roja, prominente, con botón a la ficha. */
	.emergency-card {
		background: var(--danger);
		color: #fff;
		border-radius: var(--radius-md);
		padding: var(--space-4);
	}
	.ec-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ec-ic {
		font-size: var(--text-lg);
	}
	.ec-title {
		font-family: var(--font-head);
		font-weight: 800;
		font-size: var(--text-base, 1rem);
	}
	.ec-sub {
		font-size: var(--text-xs);
		opacity: 0.9;
	}
	.ec-btn {
		display: block;
		text-align: center;
		margin-top: var(--space-3);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		border: 1px solid rgba(255, 255, 255, 0.4);
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-weight: 700;
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.ec-btn:hover {
		background: rgba(255, 255, 255, 0.24);
	}
	/* En pantallas estrechas las rejillas de la ficha se apilan. */
	@media (max-width: 720px) {
		.resumen-grid,
		.cond-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
