<script lang="ts">
	import { minutesToHhMm, type StartWindow } from '$lib/engine/startWindow';

	let {
		window: win,
		manualHint = null
	}: {
		window: StartWindow | null;
		/** best_start_time de la ficha (recomendación manual), si existe. */
		manualHint?: string | null;
	} = $props();
</script>

<div class="start-window">
	{#if win}
		{#if win.lightAlert}
			<div class="light-alert" role="alert">
				<strong>Alerta de luz:</strong>
				{win.reasons[0]}
			</div>
		{:else}
			<p class="window">
				Sal entre las <strong>{minutesToHhMm(win.startMin)}</strong> y las
				<strong>{minutesToHhMm(win.endMin)}</strong>.
			</p>
			<ul class="reasons">
				{#each win.reasons as reason (reason)}<li>{reason}</li>{/each}
			</ul>
		{/if}
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
	.start-window {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem 1rem;
		background: var(--surface);
	}
	.window {
		margin: 0;
		font-size: 1.05rem;
	}
	.reasons {
		margin: 0.4rem 0 0;
		padding-left: 1.2rem;
		font-size: 0.85rem;
		color: var(--muted-strong);
	}
	.manual {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.light-alert {
		border: 1px solid #b3261e;
		background: #fdecea;
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
