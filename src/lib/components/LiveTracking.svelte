<script lang="ts">
	/**
	 * "En ruta" (SPECS_V3.5 §6): graba tu salida con el GPS, avisa si te alejas
	 * del track, muestra ritmo/ETA y previsión de luz, y exporta la grabación a
	 * GPX. Todo offline; la posición no se envía a terceros, solo se guarda la
	 * grabación que el usuario inicia. Degrada si no hay geolocalización (Tauri
	 * de escritorio, permiso denegado…). Las cifras son estimaciones.
	 */
	import type { Position } from 'geojson';
	import {
		lightForecast,
		offRouteMeters,
		paceKmh,
		remainingMeters,
		toGpx,
		traveledMeters,
		type RecordedPoint
	} from '$lib/geo/tracking';
	import { formatKm } from '$lib/format';

	let {
		trackPos = [],
		sunsetIso = null,
		routeName = 'salida'
	}: {
		trackPos?: Position[];
		sunsetIso?: string | null;
		routeName?: string;
	} = $props();

	const OFF_ROUTE_M = 60;

	let recording = $state(false);
	let points = $state<RecordedPoint[]>([]);
	let current = $state<[number, number] | null>(null);
	let geoError = $state<string | null>(null);
	let coordsMsg = $state<string | null>(null);
	let watchId: number | null = null;

	let traveled = $derived(traveledMeters(points));
	let elapsedMs = $derived(points.length > 1 ? points[points.length - 1].t - points[0].t : 0);
	let pace = $derived(paceKmh(traveled, elapsedMs));
	let offRoute = $derived(
		current && trackPos.length > 0 ? offRouteMeters(current, trackPos) : null
	);
	let remaining = $derived(
		current && trackPos.length > 0 ? remainingMeters(current, trackPos) : null
	);
	let light = $derived(
		current && remaining !== null && sunsetIso
			? lightForecast(remaining, pace, Date.now(), Date.parse(`${sunsetIso}`))
			: null
	);

	function start() {
		if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
			geoError =
				'Este dispositivo no ofrece geolocalización (en la app de escritorio es limitada).';
			return;
		}
		geoError = null;
		points = [];
		recording = true;
		watchId = navigator.geolocation.watchPosition(
			(p) => {
				const rp: RecordedPoint = {
					lat: p.coords.latitude,
					lon: p.coords.longitude,
					t: Date.now(),
					ele: p.coords.altitude ?? undefined
				};
				current = [rp.lon, rp.lat];
				points = [...points, rp];
			},
			() => {
				geoError = 'No se pudo seguir tu posición (permiso denegado o sin señal).';
				recording = false;
			},
			{ enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
		);
	}

	function stop() {
		if (watchId !== null && typeof navigator !== 'undefined')
			navigator.geolocation.clearWatch(watchId);
		watchId = null;
		recording = false;
	}

	function downloadGpx() {
		const blob = new Blob([toGpx(points, routeName)], { type: 'application/gpx+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `salida-${new Date().toISOString().slice(0, 10)}.gpx`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function emergency() {
		if (!current) {
			coordsMsg = 'Aún no hay posición; espera a la primera lectura del GPS.';
			return;
		}
		const text = `${current[1].toFixed(5)}, ${current[0].toFixed(5)}`;
		try {
			await navigator.clipboard.writeText(text);
			coordsMsg = `Coordenadas copiadas: ${text}. Llama al 112.`;
		} catch {
			coordsMsg = `Tus coordenadas: ${text}. Llama al 112.`;
		}
	}
</script>

<section class="live no-print">
	<h3>En ruta</h3>
	{#if geoError}<p class="warn">{geoError}</p>{/if}

	{#if !recording}
		<button type="button" class="travel-btn" onclick={start}>▶ Empezar a grabar la salida</button>
		{#if points.length > 0}
			<div class="summary">
				<p>
					Salida grabada: <strong>{formatKm(traveled / 1000)}</strong> en {Math.round(
						elapsedMs / 60000
					)} min.
				</p>
				<button type="button" class="travel-btn" onclick={downloadGpx}>Descargar GPX</button>
			</div>
		{/if}
	{:else}
		<button type="button" class="travel-btn active" onclick={stop}>⏹ Terminar</button>
		<ul class="stats">
			<li>Distancia: <strong>{formatKm(traveled / 1000)}</strong></li>
			<li>Ritmo: <strong>{pace > 0 ? `${pace.toFixed(1)} km/h` : '—'}</strong></li>
			{#if remaining !== null}<li>Faltan: <strong>{formatKm(remaining / 1000)}</strong></li>{/if}
			{#if light && light.beforeSunset !== null}
				<li class:warn={!light.beforeSunset}>
					{light.beforeSunset ? '☀ Terminas con luz' : '🌙 No terminas antes del anochecer'}
				</li>
			{/if}
		</ul>
		{#if offRoute !== null && offRoute > OFF_ROUTE_M}
			<p class="warn" role="alert">⚠️ Te has alejado {Math.round(offRoute)} m de la ruta.</p>
		{/if}
	{/if}

	<button type="button" class="emergency" onclick={emergency}>🆘 112 · mis coordenadas</button>
	{#if coordsMsg}<p class="coords" role="status">{coordsMsg}</p>{/if}
</section>

<style>
	.live {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.6rem 0.9rem;
		margin: 0.5rem 0 1rem;
		background: var(--surface);
	}
	h3 {
		margin: 0 0 0.5rem;
	}
	.travel-btn {
		font: inherit;
		font-size: 0.9rem;
		padding: 0.35rem 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--brand);
		background: var(--surface);
		color: var(--brand);
		cursor: pointer;
		margin: 0 0.4rem 0.4rem 0;
	}
	.travel-btn.active {
		background: var(--brand);
		color: var(--on-brand);
	}
	.stats {
		list-style: none;
		padding: 0;
		margin: 0.4rem 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.2rem;
		font-size: 0.9rem;
	}
	.warn {
		color: var(--alert-ink);
		background: var(--alert-bg);
		border: 1px solid var(--alert-border);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		font-size: 0.88rem;
		margin: 0.3rem 0;
	}
	.emergency {
		font: inherit;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		border: 1px solid var(--alert-border);
		background: var(--alert-bg);
		color: var(--alert-ink);
		cursor: pointer;
		margin-top: 0.3rem;
	}
	.coords {
		font-size: 0.85rem;
		color: var(--muted-strong);
	}
	.summary {
		margin-top: 0.4rem;
		font-size: 0.9rem;
	}
</style>
