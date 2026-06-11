<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { isTauri } from '@tauri-apps/api/core';
	import { startWindow, minutesToHhMm } from '$lib/engine/startWindow';
	import {
		buildEmergencyModel,
		emergencyFilename,
		emergencyPlainText,
		type EmergencyInput
	} from '$lib/report/emergency';
	import { renderMarkdown } from '$lib/report/markdown';
	import { DEFAULT_EMERGENCY, loadSettings, type EmergencySettings } from '$lib/settings';
	import { forecastDates } from '$lib/weather/dates';
	import { avisosForRoute, fetchAvisosCapCached, type Aviso } from '$lib/weather/avisos';
	import { fetchOpenMeteoForecast } from '$lib/weather/openmeteo';
	import type { WeatherDay } from '$lib/types';

	let { data } = $props();
	let route = $derived(data.route);

	let date = $state('');
	let startHhMm = $state('08:00');
	let companions = $state('');
	let person = $state<EmergencySettings>({ ...DEFAULT_EMERGENCY });
	let forecast = $state<WeatherDay[] | null>(null);
	let avisos = $state<Aviso[] | null>(null);
	let ready = $state(false);
	let shareMessage = $state<string | null>(null);
	let savedTo = $state<string | null>(null);

	let weather = $derived(forecast?.find((d) => d.date === date) ?? null);

	let input = $derived.by((): EmergencyInput | null => {
		if (!ready || !date) return null;
		return {
			route,
			date,
			startHhMm,
			companions,
			person,
			weather,
			avisos: avisos ? avisosForRoute(avisos, route.zone, date) : null
		};
	});

	let model = $derived(input ? buildEmergencyModel(input) : null);
	let markdown = $derived(model && input ? renderMarkdown(model) : '');
	let plainText = $derived(input ? emergencyPlainText(input) : '');
	let filename = $derived(emergencyFilename(route.id, date));

	onMount(async () => {
		const dates = forecastDates();
		const requested = page.url.searchParams.get('fecha');
		date = requested && dates.includes(requested) ? requested : dates[0];
		person = loadSettings().emergency;
		try {
			forecast = await fetchOpenMeteoForecast(route.start.lat, route.start.lon);
		} catch (e) {
			console.error('Open-Meteo:', e);
		}
		// Hora de salida por defecto: el inicio de la ventana ideal si se puede.
		const day = forecast?.find((d) => d.date === date) ?? null;
		const window = startWindow(route, day, null);
		if (window && !window.lightAlert) startHhMm = minutesToHhMm(window.startMin);
		const { aemetApiKey } = loadSettings();
		if (aemetApiKey) {
			try {
				avisos = await fetchAvisosCapCached(aemetApiKey);
			} catch (e) {
				console.error('AEMET avisos:', e);
			}
		}
		ready = true;
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

	async function shareText() {
		shareMessage = null;
		try {
			if (navigator.share) {
				await navigator.share({ text: plainText });
				return;
			}
			await navigator.clipboard.writeText(plainText);
			shareMessage = 'Texto copiado al portapapeles: pégalo en WhatsApp o SMS.';
		} catch {
			try {
				await navigator.clipboard.writeText(plainText);
				shareMessage = 'Texto copiado al portapapeles: pégalo en WhatsApp o SMS.';
			} catch {
				shareMessage = 'No se pudo compartir; selecciona y copia el texto de la vista previa.';
			}
		}
	}

	async function saveInTauri() {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');
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
	<title>Ficha de emergencia — {route.name}</title>
</svelte:head>

<nav class="no-print breadcrumb">
	<a href={resolve('/ruta/[id]', { id: route.id })}>← Volver a la ruta</a>
</nav>

{#if model}
	<div class="no-print plan-form">
		<label>
			Hora de salida
			<input type="time" bind:value={startHhMm} />
		</label>
		<label class="grow">
			Acompañantes (vacío = vas solo/a)
			<input type="text" bind:value={companions} placeholder="Marta y Joan" />
		</label>
		<p class="hint">
			Tus datos (nombre, teléfono, vehículo…) se rellenan desde
			<a href={resolve('/ajustes')}>Ajustes → Datos de emergencia</a> y solo viven en este dispositivo.
		</p>
	</div>

	<div class="no-print actions">
		<button onclick={shareText}>Compartir texto</button>
		<button onclick={downloadMarkdown}>Descargar .md</button>
		<button onclick={() => window.print()}>Imprimir</button>
		{#if isTauri()}
			<button onclick={saveInTauri}>Guardar como…</button>
		{/if}
		{#if savedTo}<span class="saved">Guardado en {savedTo}</span>{/if}
	</div>
	{#if shareMessage}<p class="no-print hint" role="status">{shareMessage}</p>{/if}

	<article class="report">
		<header class="report-head">
			<p class="kicker">Ficha de emergencia · {date}</p>
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

	<details class="no-print preview-text">
		<summary>Texto compacto para mensajería</summary>
		<pre>{plainText}</pre>
	</details>
{:else}
	<p class="loading">Generando ficha…</p>
{/if}

<style>
	.breadcrumb {
		margin: 0.5rem 0;
	}
	.plan-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: end;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.6rem 0.85rem;
		margin-bottom: 0.75rem;
	}
	.plan-form label {
		display: grid;
		gap: 0.2rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.plan-form .grow {
		flex: 1;
		min-width: 14rem;
	}
	.plan-form input {
		font: inherit;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.hint {
		font-size: 0.8rem;
		color: var(--muted);
		margin: 0;
		flex-basis: 100%;
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
	.saved {
		font-size: 0.85rem;
		color: #2a6f4e;
	}
	.report {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.25rem 1.5rem;
		max-width: 48rem;
	}
	.report-head .kicker {
		margin: 0;
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		color: var(--muted);
	}
	.report h1 {
		margin: 0.2rem 0 1rem;
		font-size: 1.4rem;
	}
	.report h2 {
		font-size: 1.05rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.2rem;
	}
	.report dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
	}
	.report dt {
		font-weight: 600;
	}
	.report dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.preview-text {
		margin-top: 1rem;
	}
	.preview-text pre {
		white-space: pre-wrap;
		background: var(--surface-alt);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem;
		font-size: 0.85rem;
	}
	.loading {
		padding: 1rem;
	}
	@media print {
		:global(header),
		.no-print {
			display: none !important;
		}
		.report {
			border: none;
			padding: 0;
		}
	}
</style>
