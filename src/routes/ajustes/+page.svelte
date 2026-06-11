<script lang="ts">
	import { onMount } from 'svelte';
	import { isTauri } from '@tauri-apps/api/core';
	import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '$lib/settings';
	import { validateAemetKey, type AemetKeyCheck } from '$lib/weather/aemet';

	let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	let saved = $state(false);
	let pasteError = $state('');
	let keyCheck = $state<AemetKeyCheck | 'checking' | null>(null);

	const KEY_CHECK_MESSAGES: Record<AemetKeyCheck | 'checking', string> = {
		checking: 'Comprobando la api key con AEMET…',
		valid: '✓ API key válida: las rutas mostrarán la verificación AEMET.',
		invalid: '✗ AEMET rechazó la api key. Revisa que esté completa (es un texto largo).',
		unreachable: 'Guardada, pero no se pudo comprobar (sin conexión o AEMET caída).'
	};

	onMount(() => {
		settings = loadSettings();
	});

	/** La key de AEMET es un JWT sin espacios; al copiarla del email suele venir
	 * partida en líneas, y WebKit descarta saltos de línea al pegar en un input. */
	function cleanKey(text: string): string {
		return text.replace(/\s+/g, '');
	}

	function onPasteKey(e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text') ?? '';
		if (!text.trim()) return;
		e.preventDefault();
		settings.aemetApiKey = cleanKey(text);
	}

	async function pasteFromClipboard() {
		pasteError = '';
		try {
			const text = isTauri()
				? await (await import('@tauri-apps/plugin-clipboard-manager')).readText()
				: await navigator.clipboard.readText();
			if (text.trim()) settings.aemetApiKey = cleanKey(text);
		} catch {
			pasteError = 'No se pudo leer el portapapeles. Prueba con clic derecho → Pegar.';
		}
	}

	async function persist() {
		settings.aemetApiKey = cleanKey(settings.aemetApiKey);
		settings.vaultDir = settings.vaultDir.trim();
		saveSettings(settings);
		saved = true;
		setTimeout(() => (saved = false), 2500);
		if (settings.aemetApiKey) {
			const key = settings.aemetApiKey;
			keyCheck = 'checking';
			const result = await validateAemetKey(key);
			// Ignora el resultado si la key cambió mientras se comprobaba.
			if (settings.aemetApiKey === key) keyCheck = result;
		} else {
			keyCheck = null;
		}
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
			<div class="key-row">
				<input
					type="password"
					bind:value={settings.aemetApiKey}
					autocomplete="off"
					onpaste={onPasteKey}
				/>
				<button type="button" class="secondary" onclick={pasteFromClipboard}>Pegar</button>
			</div>
		</label>
		{#if pasteError}<p class="paste-error" role="alert">{pasteError}</p>{/if}
		{#if keyCheck}
			<p
				class="key-check"
				class:ok={keyCheck === 'valid'}
				class:bad={keyCheck === 'invalid'}
				role="status"
			>
				{KEY_CHECK_MESSAGES[keyCheck]}
			</p>
		{/if}
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
	.key-row {
		display: flex;
		gap: 0.5rem;
	}
	.key-row input {
		flex: 1;
	}
	.secondary {
		font: inherit;
		padding: 0.45rem 0.8rem;
		border: 1px solid #1d3a2a;
		border-radius: 6px;
		background: #fff;
		color: #1d3a2a;
		cursor: pointer;
	}
	.paste-error {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		color: #b3261e;
	}
	.key-check {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: #555;
	}
	.key-check.ok {
		color: #2a6f4e;
	}
	.key-check.bad {
		color: #b3261e;
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
