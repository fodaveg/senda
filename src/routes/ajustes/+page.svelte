<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { isTauri } from '@tauri-apps/api/core';
	import { getCatalogInfo, resetCatalogCache, type CatalogInfo } from '$lib/catalog';
	import { applyCatalogUpdate } from '$lib/catalog/store';
	import { CatalogError, checkForCatalogUpdate, DEFAULT_CATALOG_URL } from '$lib/catalog/update';
	import {
		applyTheme,
		DEFAULT_SETTINGS,
		loadSettings,
		saveSettings,
		type Settings
	} from '$lib/settings';
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

	let originLat = $state('');
	let originLon = $state('');
	let originLabel = $state('');
	let originMessage = $state<string | null>(null);

	let catalogInfo = $state<CatalogInfo | null>(null);
	let catalogStatus = $state<string | null>(null);
	let updating = $state(false);

	onMount(async () => {
		settings = loadSettings();
		if (settings.origin) {
			originLat = String(settings.origin.lat);
			originLon = String(settings.origin.lon);
			originLabel = settings.origin.label;
		}
		catalogInfo = await getCatalogInfo();
	});

	/** Geolocalización solo bajo gesto del usuario (SPECS_V2 §15). */
	function useMyPosition() {
		originMessage = null;
		if (!('geolocation' in navigator)) {
			originMessage = 'Este entorno no ofrece geolocalización.';
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(position) => {
				originLat = position.coords.latitude.toFixed(5);
				originLon = position.coords.longitude.toFixed(5);
				if (!originLabel) originLabel = 'Mi posición';
				originMessage = 'Posición capturada; guarda los ajustes para aplicarla.';
			},
			() => {
				originMessage = isTauri()
					? 'La app de escritorio no puede acceder a la ubicación del sistema. Escribe las ' +
						'coordenadas a mano (en OpenStreetMap o Google Maps: clic derecho sobre tu casa ' +
						'→ copiar coordenadas).'
					: 'No se pudo obtener la posición (permiso denegado o sin señal). Puedes escribir ' +
						'las coordenadas a mano.';
			},
			{ timeout: 10000 }
		);
	}

	function catalogLabel(info: CatalogInfo): string {
		if (!info.manifest) return `integrado en la app · ${info.routes} rutas`;
		const date = new Date(info.manifest.published_at).toLocaleDateString('es-ES');
		return `v${info.manifest.version} (${date}) · ${info.routes} rutas`;
	}

	async function updateCatalog() {
		updating = true;
		catalogStatus = 'Comprobando si hay catálogo nuevo…';
		try {
			const current = catalogInfo?.manifest ?? null;
			const update = await checkForCatalogUpdate(DEFAULT_CATALOG_URL, current);
			if (!update) {
				catalogStatus = 'Ya tienes la última versión del catálogo.';
				return;
			}
			catalogStatus = `Descargado: validando y aplicando ${update.routes.length} rutas…`;
			await applyCatalogUpdate(update.manifest, update.entries, JSON.stringify(update.routes));
			resetCatalogCache();
			catalogInfo = await getCatalogInfo();
			catalogStatus = `Catálogo actualizado: ${update.routes.length} rutas.`;
			await invalidateAll();
		} catch (e) {
			catalogStatus =
				e instanceof CatalogError
					? `No se pudo actualizar: ${e.message}`
					: 'No se pudo actualizar: sin conexión o el catálogo aún no está publicado.';
		} finally {
			updating = false;
		}
	}

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
		const lat = Number(originLat.replace(',', '.'));
		const lon = Number(originLon.replace(',', '.'));
		settings.origin =
			originLat.trim() && originLon.trim() && Number.isFinite(lat) && Number.isFinite(lon)
				? { lat, lon, label: originLabel.trim() || 'Origen' }
				: null;
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

	<fieldset>
		<legend>Catálogo de rutas</legend>
		<p class="help">
			Catálogo activo: <strong>{catalogInfo ? catalogLabel(catalogInfo) : '…'}</strong>. Las
			actualizaciones se descargan del catálogo publicado por este proyecto y se validan antes de
			aplicarse; nunca se aplica un catálogo a medias.
		</p>
		<button type="button" class="secondary" disabled={updating} onclick={updateCatalog}>
			Buscar actualizaciones de rutas
		</button>
		{#if catalogStatus}<p class="help" role="status">{catalogStatus}</p>{/if}
	</fieldset>

	<fieldset>
		<legend>Viaje (origen habitual)</legend>
		<p class="help">
			Punto de partida para estimar el tiempo de viaje en coche hasta el inicio de cada ruta (OSRM,
			estimación). Tu posición no se guarda ni se envía salvo al calcular una ruta.
		</p>
		<div class="origin-row">
			<label>
				Latitud
				<input type="text" inputmode="decimal" bind:value={originLat} placeholder="39.46975" />
			</label>
			<label>
				Longitud
				<input type="text" inputmode="decimal" bind:value={originLon} placeholder="-0.37739" />
			</label>
			<label>
				Etiqueta
				<input type="text" bind:value={originLabel} placeholder="Casa" />
			</label>
			<button type="button" class="secondary" onclick={useMyPosition}>Usar mi posición</button>
		</div>
		{#if originMessage}<p class="help" role="status">{originMessage}</p>{/if}
	</fieldset>

	<fieldset>
		<legend>Apariencia</legend>
		<label>
			Tema
			<select bind:value={settings.theme} onchange={() => applyTheme(settings.theme)}>
				<option value="auto">Automático (según el sistema)</option>
				<option value="claro">Claro forzado (sol directo)</option>
				<option value="oscuro">Oscuro</option>
			</select>
		</label>
	</fieldset>

	<fieldset>
		<legend>Datos de emergencia (opcionales)</legend>
		<p class="help">
			Se incluyen solo en la ficha de emergencia que generes para tus contactos (ficha de cada ruta
			→ "Ficha de emergencia"). Viven únicamente en este dispositivo.
		</p>
		<div class="origin-row">
			<label>
				Nombre
				<input type="text" bind:value={settings.emergency.name} />
			</label>
			<label>
				Teléfono
				<input type="text" inputmode="tel" bind:value={settings.emergency.phone} />
			</label>
		</div>
		<label>
			Datos médicos relevantes (alergias, medicación…)
			<input type="text" bind:value={settings.emergency.medical} />
		</label>
		<label>
			Vehículo y dónde quedará aparcado
			<input
				type="text"
				bind:value={settings.emergency.vehicle}
				placeholder="Dacia Duster gris, 1234-ABC, parking del inicio"
			/>
		</label>
		<label>
			Equipación visible (colores de ropa y mochila)
			<input type="text" bind:value={settings.emergency.clothing} />
		</label>
		<label>
			Margen de la hora límite de alarma (minutos tras el fin estimado)
			<input type="number" min="30" step="15" bind:value={settings.emergency.alarmMarginMin} />
		</label>
	</fieldset>

	<fieldset>
		<legend>Diagnóstico</legend>
		<p class="help">
			Con el modo debug activado, los fallos de meteo muestran el error técnico en crudo (útil para
			reportar problemas).
		</p>
		<label class="check">
			<input type="checkbox" bind:checked={settings.debugMode} />
			Modo debug
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
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem 1rem;
	}
	.help {
		font-size: 0.85rem;
		color: var(--muted);
		margin: 0.25rem 0 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
		font-size: 0.9rem;
	}
	label.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	input {
		font: inherit;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--border);
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
		background: var(--surface);
		color: #1d3a2a;
		cursor: pointer;
	}
	.paste-error {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		color: #b3261e;
	}
	.origin-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: end;
	}
	.origin-row label {
		flex: 1;
		min-width: 8rem;
	}
	.key-check {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
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
