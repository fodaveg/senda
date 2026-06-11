<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		emptyUserData,
		exportUserData,
		loadUserData,
		parseUserDataImport,
		saveUserData,
		UserImportError,
		type UserData
	} from '$lib/user/marks';
	import { diaryMarkdown, diaryStats } from '$lib/user/stats';

	let { data } = $props();

	let userData = $state<UserData>(emptyUserData());
	let importMessage = $state<string | null>(null);

	onMount(() => {
		userData = loadUserData();
	});

	let stats = $derived(diaryStats(userData, data.routes));

	function download(filename: string, content: string, type: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadDiary() {
		const date = new Date().toISOString().slice(0, 10);
		download(`diario-senderos-${date}.md`, diaryMarkdown(stats, date), 'text/markdown');
	}

	function downloadBackup() {
		const date = new Date().toISOString().slice(0, 10);
		download(`senderos-cv-datos-${date}.json`, exportUserData(userData), 'application/json');
	}

	async function importBackup(event: Event) {
		importMessage = null;
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const imported = parseUserDataImport(await file.text());
			saveUserData(imported);
			userData = imported;
			importMessage = 'Copia de seguridad importada.';
		} catch (e) {
			importMessage = e instanceof UserImportError ? e.message : 'No se pudo leer el fichero.';
		} finally {
			input.value = '';
		}
	}
</script>

<svelte:head>
	<title>Diario — Senderos CV</title>
</svelte:head>

<h1>Diario de salidas</h1>

{#if stats.totalOutings === 0}
	<p class="empty">
		Todavía no has registrado ninguna salida. Marca una ruta como hecha desde su ficha (botón
		"Registrar salida") y aparecerá aquí.
	</p>
{:else}
	<ul class="totals">
		<li><strong>{stats.totalOutings}</strong> salidas ({stats.distinctRoutes} rutas)</li>
		<li><strong>{stats.totalKm} km</strong> acumulados</li>
		<li><strong>+{stats.totalAscentM} m</strong> de desnivel</li>
	</ul>

	<div class="breakdowns">
		{#if stats.byYear.length > 0}
			<section>
				<h2>Por año</h2>
				<ul>
					{#each stats.byYear as row (row.year)}<li>{row.year}: {row.outings}</li>{/each}
				</ul>
			</section>
		{/if}
		{#if stats.byZone.length > 0}
			<section>
				<h2>Por comarca</h2>
				<ul>
					{#each stats.byZone as row (row.zone)}<li>{row.zone}: {row.outings}</li>{/each}
				</ul>
			</section>
		{/if}
		{#if stats.byType.length > 0}
			<section>
				<h2>Por tipo</h2>
				<ul>
					{#each stats.byType as row (row.type)}<li>{row.type}: {row.outings}</li>{/each}
				</ul>
			</section>
		{/if}
	</div>

	<h2>Salidas</h2>
	<ul class="outings">
		{#each stats.outings as outing (outing.routeId + outing.date + (outing.notes ?? ''))}
			<li>
				<strong>{outing.date}</strong> —
				{#if outing.routeName}
					<a href={resolve('/ruta/[id]', { id: outing.routeId })}>{outing.routeName}</a>
				{:else}
					(ruta {outing.routeId} ya no está en el catálogo)
				{/if}
				{#if outing.notes}<span class="notes">{outing.notes}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

<h2>Exportar y respaldar</h2>
<div class="actions">
	<button type="button" onclick={downloadDiary} disabled={stats.totalOutings === 0}>
		Descargar diario (.md)
	</button>
	<button type="button" class="secondary" onclick={downloadBackup}>
		Copia de seguridad (.json)
	</button>
	<label class="import">
		Importar copia
		<input type="file" accept="application/json" onchange={importBackup} />
	</label>
</div>
{#if importMessage}<p class="import-message" role="status">{importMessage}</p>{/if}

<style>
	.empty {
		color: #555;
	}
	.totals {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		font-size: 1.05rem;
	}
	.breakdowns {
		display: flex;
		flex-wrap: wrap;
		gap: 2rem;
	}
	.breakdowns h2 {
		font-size: 1rem;
	}
	.breakdowns ul {
		list-style: none;
		padding: 0;
		color: #444;
		font-size: 0.9rem;
	}
	.outings {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	.notes {
		display: block;
		color: #555;
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}
	button {
		font: inherit;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid #1d3a2a;
		background: #1d3a2a;
		color: #fff;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button.secondary,
	.import {
		background: #fff;
		color: #1d3a2a;
		border: 1px solid #1d3a2a;
		border-radius: 6px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-weight: 400;
	}
	.import input {
		display: none;
	}
	.import-message {
		color: #2a6f4e;
		font-size: 0.9rem;
	}
</style>
