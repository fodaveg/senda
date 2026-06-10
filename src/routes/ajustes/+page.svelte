<script lang="ts">
	import { onMount } from 'svelte';
	import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '$lib/settings';

	let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	let saved = $state(false);

	onMount(() => {
		settings = loadSettings();
	});

	function persist() {
		saveSettings(settings);
		saved = true;
		setTimeout(() => (saved = false), 2500);
	}
</script>

<svelte:head>
	<title>Ajustes — Senderos CV</title>
</svelte:head>

<h1>Ajustes</h1>

<form
	onsubmit={(e) => {
		e.preventDefault();
		persist();
	}}
>
	<fieldset>
		<legend>AEMET OpenData (opcional)</legend>
		<p class="help">
			Segunda fuente de pronóstico para verificación. Pide una api key gratuita en
			<a href="https://opendata.aemet.es/centrodedescargas/altaUsuario" rel="external"
				>opendata.aemet.es</a
			>. Si las fuentes difieren significativamente se muestran ambas; nunca se promedian.
		</p>
		<label>
			API key
			<input type="password" bind:value={settings.aemetApiKey} autocomplete="off" />
		</label>
	</fieldset>

	<fieldset>
		<legend>Informes (app de escritorio)</legend>
		<p class="help">
			Carpeta por defecto al usar "Guardar como…" en la app Tauri (p. ej. la carpeta de tu vault de
			Obsidian).
		</p>
		<label>
			Carpeta del vault
			<input type="text" bind:value={settings.vaultDir} placeholder="/Users/tu-usuario/vault" />
		</label>
	</fieldset>

	<button type="submit">Guardar ajustes</button>
	{#if saved}<span class="saved">Guardado.</span>{/if}
</form>

<style>
	form {
		max-width: 36rem;
		display: grid;
		gap: 1rem;
	}
	fieldset {
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}
	.help {
		font-size: 0.85rem;
		color: #555;
		margin: 0.25rem 0 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
		font-size: 0.9rem;
	}
	input {
		font: inherit;
		padding: 0.45rem 0.6rem;
		border: 1px solid #d8d4c8;
		border-radius: 6px;
	}
	button {
		justify-self: start;
		font: inherit;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid #1d3a2a;
		background: #1d3a2a;
		color: #fff;
		cursor: pointer;
	}
	.saved {
		color: #2a6f4e;
		font-size: 0.9rem;
	}
</style>
