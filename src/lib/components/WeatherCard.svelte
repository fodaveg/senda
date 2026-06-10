<script lang="ts">
	import type { WeatherDay } from '$lib/types';

	let {
		day,
		loading = false
	}: {
		/** null = sin conexión o sin pronóstico para esa fecha. */
		day: WeatherDay | null;
		loading?: boolean;
	} = $props();

	function hourOf(isoLocal: string): string {
		return isoLocal.slice(11, 16);
	}

	let consultedAt = $derived(
		day
			? new Date(day.fetched_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
			: null
	);
</script>

<div class="weather" aria-live="polite">
	{#if loading}
		<p class="empty">Consultando pronóstico…</p>
	{:else if day}
		<dl>
			<div>
				<dt>Temperatura</dt>
				<dd>{day.temperature_2m_min}° / <strong>{day.temperature_2m_max}°</strong></dd>
			</div>
			<div>
				<dt>Prob. lluvia</dt>
				<dd><strong>{day.precipitation_probability_max}%</strong></dd>
			</div>
			<div>
				<dt>Precipitación</dt>
				<dd>{day.precipitation_sum} mm</dd>
			</div>
			<div>
				<dt>UV máx.</dt>
				<dd><strong>{day.uv_index_max}</strong></dd>
			</div>
			<div>
				<dt>Viento máx.</dt>
				<dd>{day.wind_speed_10m_max} km/h</dd>
			</div>
			<div>
				<dt>Sol</dt>
				<dd>{hourOf(day.sunrise)} – {hourOf(day.sunset)}</dd>
			</div>
		</dl>
		<p class="source">Fuente: Open-Meteo · consultado {consultedAt}</p>
	{:else}
		<p class="empty">
			Sin conexión o sin pronóstico para esta fecha. La recomendación de mochila queda en
			"indeterminado" para lo que dependa de la meteo.
		</p>
	{/if}
</div>

<style>
	.weather {
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		background: #fff;
	}
	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		margin: 0;
	}
	dl div {
		display: flex;
		flex-direction: column;
	}
	dt {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #555;
	}
	dd {
		margin: 0;
		font-size: 1.05rem;
	}
	.source {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		color: #555;
	}
	.empty {
		margin: 0;
		color: #555;
	}
</style>
