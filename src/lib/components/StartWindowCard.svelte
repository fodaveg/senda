<script lang="ts">
	import { isoTimeToMinutes, minutesToHhMm, type StartWindow } from '$lib/engine/startWindow';
	import type { WeatherDay } from '$lib/types';

	let {
		window: win,
		day = null,
		manualHint = null
	}: {
		window: StartWindow | null;
		/** Día elegido: aporta amanecer/anochecer para el eje del widget. */
		day?: WeatherDay | null;
		/** best_start_time de la ficha (recomendación manual), si existe. */
		manualHint?: string | null;
	} = $props();

	// Eje temporal del widget = horas de luz del día (amanecer→anochecer),
	// redondeadas a la hora, para situar las franjas sobre una escala real (y no
	// sobre un 06–18 fijo como el mockup, que no encaja en verano).
	let axis = $derived.by(() => {
		const sr = day ? isoTimeToMinutes(day.sunrise) : null;
		const ss = day ? isoTimeToMinutes(day.sunset) : null;
		if (sr === null || ss === null || ss <= sr) return null;
		const start = Math.floor(sr / 60) * 60;
		const end = Math.ceil(ss / 60) * 60;
		return { start, end, span: end - start };
	});

	/** Posición (0–100%) de un minuto del día sobre el eje. */
	function pct(min: number): number {
		if (!axis) return 0;
		return Math.min(100, Math.max(0, ((min - axis.start) / axis.span) * 100));
	}

	// Marcas horarias repartidas por el eje (~5), alineadas con las franjas.
	let ticks = $derived.by(() => {
		if (!axis) return [];
		const startH = axis.start / 60;
		const endH = axis.end / 60;
		const step = Math.max(1, Math.round((endH - startH) / 4));
		const out: number[] = [];
		for (let h = startH; h <= endH; h += step) out.push(h);
		return out;
	});
</script>

<div class="start-window">
	{#if win && win.lightAlert}
		<div class="light-alert" role="alert">
			<strong>No cabe en horas de luz:</strong>
			{win.reasons[0]}
		</div>
	{:else if win}
		<div class="sw-range">
			<span class="sw-time">{minutesToHhMm(win.startMin)} – {minutesToHhMm(win.endMin)}</span>
			<span class="sw-caption">para terminar con margen de luz</span>
		</div>

		{#if axis}
			<div class="sw-bar" aria-hidden="true">
				<span
					class="sw-ideal"
					style:left={`${pct(win.startMin)}%`}
					style:width={`${Math.max(2, pct(win.endMin) - pct(win.startMin))}%`}
				></span>
				{#if win.hotSpan}
					<span
						class="sw-avoid"
						style:left={`${pct(win.hotSpan[0])}%`}
						style:width={`${Math.max(2, pct(win.hotSpan[1]) - pct(win.hotSpan[0]))}%`}
					></span>
				{/if}
			</div>
			<div class="sw-axis" aria-hidden="true">
				{#each ticks as h (h)}
					<span class="sw-tick" style:left={`${pct(h * 60)}%`}
						>{String(h % 24).padStart(2, '0')}h</span
					>
				{/each}
			</div>
		{/if}

		<div class="sw-legend">
			<span><i class="sw-dot ideal"></i> Franja ideal</span>
			{#if win.hotSpan}<span><i class="sw-dot avoid"></i> Evitar por calor/UV</span>{/if}
		</div>

		<ul class="reasons">
			{#each win.reasons as reason (reason)}<li>{reason}</li>{/each}
		</ul>
		{#if manualHint}
			<p class="manual">Recomendación de la ficha: {manualHint}</p>
		{/if}
	{:else if manualHint}
		<p class="window">Recomendación de la ficha: {manualHint}</p>
	{:else}
		<p class="empty">
			Sin duración estimada o sin pronóstico para esta fecha no se puede calcular una ventana de
			inicio.
		</p>
	{/if}
</div>

<style>
	/* Contenedor plano: el marco lo pone la tarjeta que envuelve al widget. */
	.start-window {
		display: block;
	}
	/* Franja recomendada destacada (hora + matiz). */
	.sw-range {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.sw-time {
		font-family: var(--font-head);
		font-weight: 800;
		font-size: var(--text-xl);
		color: var(--ok);
	}
	.sw-caption {
		font-size: var(--text-xs);
		color: var(--muted);
	}
	/* Barra de franjas: pista neutra con la franja ideal (verde) y, si la hay, la
	   franja a evitar por calor/UV (ámbar), posicionadas sobre el eje de luz. */
	.sw-bar {
		position: relative;
		height: 12px;
		border-radius: 999px;
		background: var(--surface-alt);
		overflow: hidden;
		margin-top: var(--space-3);
	}
	.sw-ideal,
	.sw-avoid {
		position: absolute;
		top: 0;
		bottom: 0;
	}
	.sw-ideal {
		background: var(--ok);
	}
	.sw-avoid {
		background: var(--warn);
	}
	.sw-axis {
		position: relative;
		height: 1.1em;
		margin-top: 4px;
	}
	.sw-tick {
		position: absolute;
		transform: translateX(-50%);
		font-size: 10px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.sw-legend {
		margin-top: var(--space-2);
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		font-size: var(--text-xs);
		color: var(--muted);
	}
	.sw-dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 2px;
		vertical-align: -1px;
		margin-right: 4px;
	}
	.sw-dot.ideal {
		background: var(--ok);
	}
	.sw-dot.avoid {
		background: var(--warn);
	}
	.reasons {
		margin: var(--space-3) 0 0;
		padding-left: 1.2rem;
		font-size: 0.85rem;
		color: var(--muted-strong);
	}
	.manual {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.window {
		margin: 0;
		font-size: 1.05rem;
	}
	.light-alert {
		border: 1px solid var(--alert-border);
		background: var(--alert-bg);
		color: var(--alert-ink);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
	}
	.empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
