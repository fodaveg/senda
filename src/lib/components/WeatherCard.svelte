<script lang="ts">
	import type { WeatherDay } from '$lib/types';
	import type { AemetDay, WeatherDiscrepancy } from '$lib/weather/aemet';

	let {
		day,
		loading = false,
		aemet = null,
		discrepancies = [],
		aemetNote = null,
		error = null
	}: {
		/** null = sin conexión o sin pronóstico para esa fecha. */
		day: WeatherDay | null;
		loading?: boolean;
		/** Verificación AEMET para la misma fecha, si está configurada. */
		aemet?: AemetDay | null;
		discrepancies?: WeatherDiscrepancy[];
		/** Motivo por el que no hay verificación AEMET (key rechazada…). */
		aemetNote?: string | null;
		/** Error en crudo del módulo meteo, mostrado para diagnóstico. */
		error?: string | null;
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
		{#if aemet}
			<p class="aemet">
				Verificación AEMET: {aemet.temperature_2m_min}° / {aemet.temperature_2m_max}° · prob. lluvia {aemet.precipitation_probability_max}%{#if aemet.uv_index_max !== null}
					· UV {aemet.uv_index_max}{/if}
			</p>
			{#if discrepancies.length > 0}
				<div class="discrepancy" role="alert">
					<strong>Las fuentes discrepan</strong> — se muestran ambas, nunca se promedian:
					<ul>
						{#each discrepancies as d (d.label)}
							<li>{d.label}: Open-Meteo {d.openMeteo} / AEMET {d.aemet}</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else if aemetNote}
			<p class="aemet-note">{aemetNote}</p>
		{/if}
	{:else}
		<p class="empty">
			Sin conexión o sin pronóstico para esta fecha. La recomendación de mochila queda en
			"indeterminado" para lo que dependa de la meteo.
		</p>
		{#if error}
			<p class="raw-error">Detalle técnico: <code>{error}</code></p>
		{/if}
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
	.aemet {
		margin: 0.4rem 0 0;
		font-size: 0.85rem;
		color: #333;
	}
	.aemet-note {
		margin: 0.4rem 0 0;
		font-size: 0.8rem;
		color: #8a5a00;
	}
	.raw-error {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: #b3261e;
		overflow-wrap: anywhere;
	}
	.discrepancy {
		margin-top: 0.5rem;
		border: 1px solid #b3261e;
		background: #fdecea;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}
	.discrepancy ul {
		margin: 0.3rem 0 0;
		padding-left: 1.2rem;
	}
</style>
