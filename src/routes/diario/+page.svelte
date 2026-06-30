<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		emptyUserData,
		exportUserData,
		parseUserDataImport,
		UserImportError,
		type UserData
	} from '$lib/user/marks';
	import { diaryMarkdown, diaryStats } from '$lib/user/stats';
	import { achievements, comarcaProgress } from '$lib/user/achievements';
	import { getUserRepository } from '$lib/user/context';
	import { Card } from '$lib/components/ui';
	import { formatKm, formatMeters } from '$lib/format';

	// Icono por logro (presentación; no es dato). Si aparece un id nuevo sin
	// entrada, cae a una medalla genérica.
	const ACHIEVEMENT_ICON: Record<string, string> = {
		'salidas-10': '🥾',
		'salidas-50': '🏆',
		'km-100': '📏',
		'km-500': '🛤️',
		'ascent-10000': '⛰️',
		'gr-1': '🧭',
		'gr-5': '🗺️',
		'comarca-1': '📍',
		'comarca-5': '🗂️'
	};

	let { data } = $props();

	const repo = getUserRepository();

	let userData = $state<UserData>(emptyUserData());
	let importMessage = $state<string | null>(null);

	onMount(() => {
		userData = repo.loadMarks();
	});

	let stats = $derived(diaryStats(userData, data.routes));
	let logros = $derived(achievements(userData, data.routes));
	let comarcas = $derived(comarcaProgress(userData, data.routes));

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
			repo.saveMarks(imported);
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
	<title>Diario — Senda</title>
</svelte:head>

<h1>Diario de salidas</h1>

{#if stats.totalOutings === 0}
	<Card pad="lg" class="empty-card">
		<p class="empty">
			Todavía no has registrado ninguna salida. Marca una ruta como hecha desde su ficha (botón
			"Registrar salida") y aparecerá aquí.
		</p>
	</Card>
{:else}
	<!-- 4 estadísticas (handoff v6): rutas, distancia, desnivel, días. -->
	<div class="stat-grid">
		<Card pad="md" class="stat">
			<div class="stat-num">{stats.distinctRoutes}</div>
			<div class="stat-label">Rutas hechas</div>
		</Card>
		<Card pad="md" class="stat">
			<div class="stat-num">{formatKm(stats.totalKm)}</div>
			<div class="stat-label">Distancia</div>
		</Card>
		<Card pad="md" class="stat">
			<div class="stat-num">+{formatMeters(stats.totalAscentM)}</div>
			<div class="stat-label">Desnivel</div>
		</Card>
		<Card pad="md" class="stat">
			<div class="stat-num">{stats.distinctDays}</div>
			<div class="stat-label">Días en monte</div>
		</Card>
	</div>

	<!-- Logros como medallas: conseguido (relleno) vs bloqueado (punteado). -->
	<Card pad="lg" class="section-card">
		<h2 class="card-title">Logros</h2>
		<ul class="achievements">
			{#each logros as a (a.id)}
				<li class="badge" class:done={a.achieved}>
					<span class="badge-medal" aria-hidden="true">{ACHIEVEMENT_ICON[a.id] ?? '🏅'}</span>
					<span class="badge-label">{a.label}</span>
					<span class="badge-state">{a.achieved ? 'Conseguido' : 'Bloqueado'}</span>
				</li>
			{/each}
		</ul>
	</Card>

	<!-- Progreso por comarca: barras. -->
	<Card pad="lg" class="section-card">
		<h2 class="card-title">
			Progreso por comarca
			<span class="sub">{comarcas.completed}/{comarcas.total} completas</span>
		</h2>
		<ul class="comarcas">
			{#each comarcas.perComarca as c (c.zone)}
				<li class:complete={c.total > 0 && c.done === c.total}>
					<div class="crow">
						<span class="zname">{c.zone}</span>
						<span class="cnum">{c.done} / {c.total}</span>
					</div>
					<span class="cbar"
						><span class="cfill" style="width:{(c.done / c.total) * 100}%"></span></span
					>
				</li>
			{/each}
		</ul>
	</Card>

	<!-- Por año / por tipo: desgloses compactos. -->
	{#if stats.byYear.length > 0 || stats.byType.length > 0}
		<div class="breakdown-grid">
			{#if stats.byYear.length > 0}
				<Card pad="lg" class="section-card">
					<h2 class="card-title">Por año</h2>
					<ul class="breakdown">
						{#each stats.byYear as row (row.year)}
							<li><span>{row.year}</span><strong>{row.outings}</strong></li>
						{/each}
					</ul>
				</Card>
			{/if}
			{#if stats.byType.length > 0}
				<Card pad="lg" class="section-card">
					<h2 class="card-title">Por tipo</h2>
					<ul class="breakdown">
						{#each stats.byType as row (row.type)}
							<li><span>{row.type}</span><strong>{row.outings}</strong></li>
						{/each}
					</ul>
				</Card>
			{/if}
		</div>
	{/if}

	<Card pad="lg" class="section-card">
		<h2 class="card-title">Salidas</h2>
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
	</Card>
{/if}

<Card pad="lg" class="section-card">
	<h2 class="card-title">Exportar y respaldar</h2>
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
</Card>

<style>
	/* Cada bloque del diario es una tarjeta separada (handoff v6). */
	:global(.section-card),
	:global(.empty-card) {
		margin-bottom: var(--space-4);
		box-shadow: var(--shadow-sm);
	}
	.card-title {
		font-family: var(--font-head);
		font-size: var(--text-md, 1.05rem);
		font-weight: 700;
		margin: 0 0 var(--space-3);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.empty {
		color: var(--muted);
		margin: 0;
	}
	.sub {
		font-weight: 600;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	/* 4 tarjetas de estadística. */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	:global(.stat) {
		box-shadow: var(--shadow-sm);
	}
	.stat-num {
		font-family: var(--font-head);
		font-weight: 800;
		font-size: var(--text-2xl, 1.7rem);
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.stat-label {
		margin-top: 2px;
		font-size: var(--text-xs);
		color: var(--muted);
		font-weight: 600;
	}

	/* Logros como medallas. */
	.achievements {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	.badge {
		width: 84px;
		text-align: center;
	}
	.badge-medal {
		width: 56px;
		height: 56px;
		margin: 0 auto;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		background: var(--surface-alt);
		border: 1.5px dashed var(--border);
		filter: grayscale(1);
		opacity: 0.7;
	}
	.badge.done .badge-medal {
		background: var(--brand);
		border: none;
		box-shadow: 0 0 0 5px var(--brand-soft);
		filter: none;
		opacity: 1;
	}
	.badge-label {
		display: block;
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		font-weight: 700;
		line-height: 1.2;
	}
	.badge:not(.done) .badge-label {
		color: var(--muted);
	}
	.badge-state {
		display: block;
		font-size: 10px;
		color: var(--muted);
	}

	/* Progreso por comarca. */
	.comarcas {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-3);
	}
	.crow {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-sm);
		margin-bottom: var(--space-1);
	}
	.zname {
		font-weight: 600;
	}
	.comarcas li.complete .zname {
		color: var(--brand);
	}
	.cbar {
		display: block;
		height: 8px;
		background: var(--surface-alt);
		border-radius: 999px;
		overflow: hidden;
	}
	.cfill {
		display: block;
		height: 100%;
		background: var(--brand);
	}
	.cnum {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	/* Desgloses por año / tipo. */
	.breakdown-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}
	.breakdown {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}
	.breakdown li {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.breakdown strong {
		color: var(--ink);
	}

	.outings {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}
	.notes {
		display: block;
		color: var(--muted);
		font-size: var(--text-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
	}
	button {
		font: inherit;
		font-weight: 600;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--brand);
		background: var(--brand);
		color: var(--on-brand);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button.secondary,
	.import {
		background: var(--surface);
		color: var(--brand);
		border: 1px solid var(--brand);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-4);
		cursor: pointer;
		font-weight: 600;
	}
	.import input {
		display: none;
	}
	.import-message {
		color: var(--ok, #2a6f4e);
		font-size: var(--text-sm);
		margin: var(--space-2) 0 0;
	}

	@media (max-width: 720px) {
		.stat-grid {
			grid-template-columns: 1fr 1fr;
		}
		.breakdown-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
