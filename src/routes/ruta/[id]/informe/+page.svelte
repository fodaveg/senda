<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { isTauri } from '@tauri-apps/api/core';
	import { gearItems, gearRules } from '$lib/data/gear';
	import { routeById } from '$lib/data/routes';
	import { wildlifeForZone } from '$lib/data/wildlife';
	import { evaluateGear } from '$lib/engine';
	import { buildReportModel, type ReportModel } from '$lib/report/model';
	import { renderMarkdown, reportFilename } from '$lib/report/markdown';
	import { loadSettings } from '$lib/settings';
	import { forecastDates, seasonForDate } from '$lib/weather/dates';
	import { fetchOpenMeteoForecast } from '$lib/weather/openmeteo';
	import type { WeatherDay } from '$lib/types';

	let { data } = $props();
	let route = $derived(data.route);

	let date = $state('');
	let forecast = $state<WeatherDay[] | null>(null);
	let ready = $state(false);
	let savedTo = $state<string | null>(null);

	let model = $derived.by((): ReportModel | null => {
		if (!ready || !date) return null;
		const weather = forecast?.find((d) => d.date === date) ?? null;
		const decisions = evaluateGear(route, weather, seasonForDate(date), gearItems, gearRules);
		const alternatives = route.alternatives
			.map((id) => routeById(id))
			.filter((r) => r !== undefined)
			.map((r) => ({ id: r.id, name: r.name }));
		return buildReportModel({
			route,
			date,
			weather,
			decisions,
			wildlife: wildlifeForZone(route.zone),
			alternatives
		});
	});

	let markdown = $derived(model ? renderMarkdown(model) : '');
	let filename = $derived(reportFilename(route.id, date));

	onMount(async () => {
		const dates = forecastDates();
		const requested = page.url.searchParams.get('fecha');
		date = requested && dates.includes(requested) ? requested : dates[0];
		try {
			forecast = await fetchOpenMeteoForecast(route.start.lat, route.start.lon);
		} catch {
			forecast = null;
		} finally {
			ready = true;
		}
	});

	function downloadMarkdown() {
		const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function saveInTauri() {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');
		// Carpeta del vault configurada en /ajustes, si existe.
		const { vaultDir } = loadSettings();
		const path = await save({
			defaultPath: vaultDir ? `${vaultDir}/${filename}` : filename,
			filters: [{ name: 'Markdown', extensions: ['md'] }]
		});
		if (!path) return;
		await writeTextFile(path, markdown);
		savedTo = path;
	}
</script>

<svelte:head>
	<title>Informe — {route.name}</title>
</svelte:head>

<nav class="no-print breadcrumb">
	<a href={resolve('/ruta/[id]', { id: route.id })}>← Volver a la ruta</a>
</nav>

{#if model}
	<div class="no-print actions">
		<button onclick={downloadMarkdown}>Descargar .md</button>
		<button onclick={() => window.print()}>Imprimir</button>
		{#if isTauri()}
			<button onclick={saveInTauri}>Guardar como…</button>
		{/if}
		{#if savedTo}
			<span class="saved">Guardado en {savedTo}</span>
		{/if}
	</div>

	<article class="report">
		<header class="report-head">
			<p class="kicker">Informe de ruta · {date}</p>
			<h1>{model.title}</h1>
		</header>
		{#each model.sections as section (section.title)}
			<section>
				<h2>{section.title}</h2>
				{#each section.blocks as block, i (i)}
					{#if block.kind === 'paragraph'}
						<p>{block.text}</p>
					{:else if block.kind === 'list'}
						<ul>
							{#each block.items as item (item)}<li>{item}</li>{/each}
						</ul>
					{:else if block.kind === 'fields'}
						<dl>
							{#each block.fields as field (field.label)}
								<dt>{field.label}</dt>
								<dd>{field.value}</dd>
							{/each}
						</dl>
					{/if}
				{/each}
			</section>
		{/each}
	</article>
{:else}
	<p class="loading">Generando informe…</p>
{/if}

<style>
	.breadcrumb {
		margin: 0.5rem 0;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.actions button {
		font: inherit;
		padding: 0.45rem 0.9rem;
		border-radius: 6px;
		border: 1px solid #1d3a2a;
		background: #1d3a2a;
		color: #fff;
		cursor: pointer;
	}
	.actions button:hover {
		background: #2a5440;
	}
	.saved {
		font-size: 0.85rem;
		color: #2a6f4e;
	}
	.report {
		background: #fff;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		padding: 1.5rem 2rem;
		max-width: 48rem;
	}
	.kicker {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.78rem;
		color: #555;
		margin: 0;
	}
	.report h1 {
		margin: 0.2rem 0 1rem;
		font-size: 1.5rem;
	}
	.report h2 {
		font-size: 1.05rem;
		border-bottom: 1px solid #e2ded2;
		padding-bottom: 0.2rem;
		margin: 1.2rem 0 0.5rem;
	}
	.report dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 1rem;
		margin: 0;
	}
	.report dt {
		font-weight: 600;
	}
	.report dd {
		margin: 0;
	}
	.report ul {
		margin: 0.3rem 0;
		padding-left: 1.2rem;
	}
	.loading {
		padding: 1rem;
	}

	@media print {
		:global(header),
		.no-print {
			display: none !important;
		}
		:global(main) {
			max-width: none;
			padding: 0;
		}
		.report {
			border: none;
			padding: 0;
		}
	}
</style>
