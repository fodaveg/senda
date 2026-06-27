<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Map from '$lib/components/LazyMap.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { Chip, TypeBadge } from '$lib/components/ui';
	import { emptyUserData, isDone, type ToggleMark, type UserData } from '$lib/user/marks';
	import { getUserRepository } from '$lib/user/context';
	import { applyFilters, EMPTY_FILTERS, type RouteFilters } from '$lib/filters';
	import { loadDiscoverPrefs, saveDiscoverPrefs } from '$lib/discoverPrefs';
	import { PROVINCES } from '$lib/geo/province';
	import { formatDuration, formatKm, formatMeters } from '$lib/format';
	import { haversineMeters } from '$lib/geo/distance';
	import { buildSearchIndex, searchIndex } from '$lib/search';
	import { type OriginSetting } from '$lib/settings';
	import { STATUS_FILTER_OPTIONS, STATUS_LABELS } from '$lib/status';
	import type { RouteType } from '$lib/types';

	const TYPES: RouteType[] = ['GR', 'PR', 'SL'];
	const MARK_LABELS: Record<string, string> = {
		favorita: 'Favoritas',
		me_gusta: 'Me gustan',
		quiero_hacer: 'Quiero hacer',
		hecha: 'Hechas'
	};

	let { data } = $props();
	let routes = $derived(data.routes);

	let filters = $state<RouteFilters>({ ...EMPTY_FILTERS, types: [] });
	let query = $state('');
	// El panel "Más filtros" arranca abierto (variante A): los chips resumen lo
	// activo y este panel da el control fino. Plegable para reducir ruido.
	let showMoreFilters = $state(true);

	// Marcas de usuario como filtro (SPECS_V2 §6/§8).
	const repo = getUserRepository();

	let userData = $state<UserData>(emptyUserData());
	let origin = $state<OriginSetting | null>(null);
	// Se recuerda el filtro geográfico (provincia/comarca) entre visitas (pulido v3).
	let prefsLoaded = $state(false);
	onMount(() => {
		userData = repo.loadMarks();
		origin = repo.loadSettings().origin;
		const prefs = loadDiscoverPrefs();
		filters.province = prefs.province;
		filters.zone = prefs.zone;
		prefsLoaded = true;
	});

	// Persiste el filtro geográfico cuando cambia (tras restaurarlo al montar).
	$effect(() => {
		const prefs = { province: filters.province, zone: filters.zone };
		if (prefsLoaded) saveDiscoverPrefs(prefs);
	});
	let sortBy = $state<'nombre' | 'cercania'>('nombre');

	// Mini-ficha flotante al pulsar un pin del mapa (previsualización).
	let preview = $state<(typeof routes)[number] | null>(null);

	// Si el filtro deja fuera la ruta previsualizada, la mini-ficha se cierra.
	$effect(() => {
		if (preview && !filtered.some((r) => r.id === preview!.id)) preview = null;
	});
	let markFilter = $state<ToggleMark | 'hecha' | null>(null);

	// Índice de búsqueda precomputado (SPECS_V4 §B6): se reconstruye solo cuando
	// cambia el catálogo, no en cada pulsación del buscador.
	let searchIdx = $derived(buildSearchIndex(routes));

	let filtered = $derived.by(() => {
		const result = applyFilters(searchIndex(searchIdx, query), filters).filter((route) => {
			if (markFilter === null) return true;
			const marks = userData.marks[route.id];
			return markFilter === 'hecha' ? isDone(marks) : Boolean(marks?.[markFilter]);
		});
		// Cercanía en línea recta desde el origen habitual (etiquetada así).
		if (sortBy === 'cercania' && origin) {
			const o: [number, number] = [origin.lon, origin.lat];
			return [...result].sort(
				(a, b) =>
					haversineMeters(o, [a.start.lon, a.start.lat]) -
					haversineMeters(o, [b.start.lon, b.start.lat])
			);
		}
		return result;
	});

	/** Botón dado (SPECS_V2 §6): una ruta al azar del resultado actual. */
	function openRandom() {
		if (filtered.length === 0) return;
		const route = filtered[Math.floor(Math.random() * filtered.length)];
		void goto(resolve('/ruta/[id]', { id: route.id }));
	}

	let markers = $derived(
		filtered.map((r) => ({ id: r.id, lat: r.start.lat, lon: r.start.lon, name: r.name }))
	);

	let unionBbox = $derived.by((): [number, number, number, number] | null => {
		const boxes = filtered.map((r) => r.bbox).filter((b) => b !== null);
		if (boxes.length === 0) return null;
		return boxes.reduce((acc, b) => [
			Math.min(acc[0], b[0]),
			Math.min(acc[1], b[1]),
			Math.max(acc[2], b[2]),
			Math.max(acc[3], b[3])
		]);
	});

	function toggleType(type: RouteType) {
		filters.types = filters.types.includes(type)
			? filters.types.filter((t) => t !== type)
			: [...filters.types, type];
	}

	// ── Chips de filtro activo (variante A) ───────────────────────────────────
	// Cada filtro vigente se muestra como chip quitable; quitarlo lo restablece.
	let activeChips = $derived.by(() => {
		const chips: { key: string; label: string; remove: () => void }[] = [];
		for (const t of filters.types)
			chips.push({ key: `type-${t}`, label: t, remove: () => toggleType(t) });
		if (filters.maxDistanceKm !== null)
			chips.push({
				key: 'dist',
				label: `≤ ${filters.maxDistanceKm} km`,
				remove: () => (filters.maxDistanceKm = null)
			});
		if (filters.maxAscentM !== null)
			chips.push({
				key: 'ascent',
				label: `≤ ${filters.maxAscentM} m desnivel`,
				remove: () => (filters.maxAscentM = null)
			});
		if (filters.circular !== null)
			chips.push({
				key: 'circular',
				label: filters.circular ? 'Circular' : 'Lineal',
				remove: () => (filters.circular = null)
			});
		if (filters.province !== null)
			chips.push({
				key: 'province',
				label: PROVINCES.find((p) => p.id === filters.province)?.label ?? filters.province,
				remove: () => {
					filters.province = null;
					filters.zone = null;
				}
			});
		if (filters.status !== null)
			chips.push({
				key: 'status',
				label:
					filters.status === 'todas' ? 'Incluye deshabilitadas' : STATUS_LABELS[filters.status],
				remove: () => (filters.status = null)
			});
		if (filters.withWater)
			chips.push({ key: 'water', label: 'Con agua', remove: () => (filters.withWater = false) });
		if (filters.highShade)
			chips.push({
				key: 'shade',
				label: 'Alta sombra',
				remove: () => (filters.highShade = false)
			});
		if (markFilter !== null)
			chips.push({
				key: 'mark',
				label: MARK_LABELS[markFilter] ?? markFilter,
				remove: () => (markFilter = null)
			});
		return chips;
	});

	/** Restablece todos los filtros y la búsqueda a su estado vacío. */
	function clearAllFilters() {
		filters = { ...EMPTY_FILTERS, types: [] };
		markFilter = null;
		query = '';
	}
</script>

<svelte:head>
	<title>Senda — rutas homologadas</title>
</svelte:head>

<h1>Rutas</h1>

<div class="search-row">
	<input
		type="search"
		class="search"
		placeholder="Buscar por nombre, municipio o comarca…"
		aria-label="Buscar rutas"
		bind:value={query}
	/>
	<button
		type="button"
		class="more-toggle"
		aria-expanded={showMoreFilters}
		onclick={() => (showMoreFilters = !showMoreFilters)}
	>
		{showMoreFilters ? 'Menos filtros' : 'Más filtros'}
	</button>
	<button
		type="button"
		class="dice"
		title="Abrir una ruta al azar del resultado actual"
		aria-label="Ruta al azar"
		disabled={filtered.length === 0}
		onclick={openRandom}
	>
		🎲
	</button>
</div>

{#if activeChips.length > 0}
	<div class="chips" aria-label="Filtros activos">
		{#each activeChips as chip (chip.key)}
			<Chip label={chip.label} onRemove={chip.remove}>{chip.label}</Chip>
		{/each}
		<button type="button" class="clear-all" onclick={clearAllFilters}>Limpiar todo</button>
	</div>
{/if}

{#if showMoreFilters}
	<fieldset class="filters">
		<legend>Filtros</legend>
		<div class="filter-group" role="group" aria-label="Tipo de sendero">
			{#each TYPES as type (type)}
				<label>
					<input
						type="checkbox"
						checked={filters.types.includes(type)}
						onchange={() => toggleType(type)}
					/>
					{type}
				</label>
			{/each}
		</div>
		<label>
			Distancia máx.
			<select bind:value={filters.maxDistanceKm}>
				<option value={null}>—</option>
				<option value={5}>5 km</option>
				<option value={10}>10 km</option>
				<option value={15}>15 km</option>
				<option value={25}>25 km</option>
			</select>
		</label>
		<label>
			Desnivel máx.
			<select bind:value={filters.maxAscentM}>
				<option value={null}>—</option>
				<option value={300}>300 m</option>
				<option value={600}>600 m</option>
				<option value={1000}>1000 m</option>
			</select>
		</label>
		<label>
			Recorrido
			<select bind:value={filters.circular}>
				<option value={null}>—</option>
				<option value={true}>Circular</option>
				<option value={false}>Lineal</option>
			</select>
		</label>
		<label>
			Provincia
			<select bind:value={filters.province}>
				<option value={null}>—</option>
				{#each PROVINCES as p (p.id)}
					<option value={p.id}>{p.label}</option>
				{/each}
			</select>
		</label>
		<label>
			Ordenar
			<select bind:value={sortBy}>
				<option value="nombre">por nombre</option>
				<option value="cercania" disabled={origin === null}>
					por cercanía{origin === null ? ' (configura origen)' : ' (línea recta)'}
				</option>
			</select>
		</label>
		<label>
			Marcas
			<select bind:value={markFilter}>
				<option value={null}>—</option>
				<option value="favorita">Favoritas</option>
				<option value="me_gusta">Me gustan</option>
				<option value="quiero_hacer">Quiero hacer</option>
				<option value="hecha">Hechas</option>
			</select>
		</label>
		<label>
			Estado
			<select bind:value={filters.status}>
				<option value={null}>— (sin deshabilitadas)</option>
				{#each STATUS_FILTER_OPTIONS as status (status)}
					<option value={status}>{STATUS_LABELS[status]}</option>
				{/each}
				<option value="todas">Todas (incl. deshabilitadas)</option>
			</select>
		</label>
		<label class="check">
			<input type="checkbox" bind:checked={filters.withWater} /> Con agua
		</label>
		<label class="check">
			<input type="checkbox" bind:checked={filters.highShade} /> Alta sombra
		</label>
	</fieldset>
{/if}

<div class="discover">
	<div class="results-col">
		<p class="count">{filtered.length} de {routes.length} rutas</p>

		{#if filtered.length === 0}
			<div class="empty">
				<p class="empty-title">Sin resultados</p>
				<p class="empty-desc">No hay rutas con estos filtros. Prueba a quitar alguno.</p>
				<button type="button" class="clear-all" onclick={clearAllFilters}>Limpiar todo</button>
			</div>
		{:else}
			<ul class="route-list">
				{#each filtered as route (route.id)}
					<li>
						<a href={resolve('/ruta/[id]', { id: route.id })}>
							<span class="row-top">
								<TypeBadge type={route.type} />
								<strong class="row-name">{route.name}</strong>
								<StatusBadge status={route.status} detail={route.status_detail} />
							</span>
							<span class="meta">
								{formatKm(route.distance_km)}
								{#if route.ascent_m !== null}· +{formatMeters(route.ascent_m)}{/if}
								{#if route.est_duration_min !== null}· {formatDuration(route.est_duration_min)}{/if}
								{#if route.circular !== null}· {route.circular ? 'circular' : 'lineal'}{/if}
								{#if route.municipality}· {route.municipality}{/if}
							</span>
							<span class="source">FEMECV · oficial</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="map-col">
		<div class="map-wrap">
			<Map
				{markers}
				bbox={unionBbox}
				onMarkerClick={(id) => (preview = filtered.find((r) => r.id === id) ?? null)}
			/>
			{#if preview}
				<aside class="preview-card" aria-label="Previsualización de ruta">
					<button
						type="button"
						class="preview-close"
						aria-label="Cerrar previsualización"
						onclick={() => (preview = null)}
					>
						×
					</button>
					<p class="preview-head">
						<TypeBadge type={preview.type} />
						<StatusBadge status={preview.status} detail={preview.status_detail} />
					</p>
					<strong class="preview-name">{preview.name}</strong>
					<p class="preview-meta">
						{formatKm(preview.distance_km)}
						{#if preview.ascent_m !== null}· +{formatMeters(preview.ascent_m)}{/if}
						{#if preview.est_duration_min !== null}· {formatDuration(preview.est_duration_min)}{/if}
						{#if preview.circular !== null}· {preview.circular ? 'circular' : 'lineal'}{/if}
					</p>
					{#if preview.municipality}<p class="preview-meta">
							{preview.municipality}{#if preview.zone}
								· {preview.zone}{/if}
						</p>{/if}
					{#if preview.water_points.length > 0}
						<p class="preview-meta">💧 {preview.water_points.length} fuente(s) en ruta</p>
					{/if}
					<a class="preview-link" href={resolve('/ruta/[id]', { id: preview.id })}>Ver ficha →</a>
				</aside>
			{/if}
		</div>
	</div>
</div>

<style>
	.search-row {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.search {
		flex: 1;
		font: inherit;
		font-size: var(--text-base);
		padding: 0 var(--space-3);
		min-height: var(--touch-min);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--ink);
	}
	.more-toggle {
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		padding: 0 var(--space-3);
		min-height: var(--touch-min);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		white-space: nowrap;
	}
	.more-toggle:hover {
		border-color: var(--brand);
	}
	.dice {
		font-size: 1.3rem;
		padding: 0 var(--space-3);
		min-height: var(--touch-min);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		cursor: pointer;
	}
	.dice:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.dice:hover:not(:disabled) {
		border-color: var(--brand);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: var(--space-3);
	}
	.clear-all {
		font: inherit;
		font-size: var(--text-sm);
		background: none;
		border: none;
		color: var(--brand);
		text-decoration: underline;
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-4);
		align-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-4);
	}
	.filters legend {
		font-weight: 600;
		font-size: var(--text-sm);
		padding: 0 var(--space-2);
	}
	.filter-group {
		display: flex;
		gap: var(--space-3);
	}
	.filters label {
		font-size: var(--text-sm);
	}
	.filters select {
		font: inherit;
		font-size: var(--text-sm);
		margin-left: var(--space-1);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--ink);
	}
	.filters .check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	/* Variante A: lista (1.25fr) + mapa pegajoso (1fr). */
	.discover {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	.map-col {
		position: sticky;
		top: var(--space-4);
	}
	.map-wrap {
		position: relative;
		height: 460px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	@media (max-width: 720px) {
		.discover {
			grid-template-columns: 1fr;
		}
		.map-col {
			position: static;
			order: -1;
		}
		.map-wrap {
			height: 320px;
		}
	}

	.preview-card {
		position: absolute;
		left: var(--space-3);
		bottom: var(--space-3);
		z-index: 5;
		max-width: 20rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: var(--space-3) var(--space-4);
	}
	.preview-close {
		position: absolute;
		top: var(--space-1);
		right: var(--space-2);
		border: none;
		background: none;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
		padding: var(--space-1);
	}
	.preview-close:hover {
		color: var(--ink);
	}
	.preview-head {
		margin: 0 1.2rem 0.3rem 0;
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.preview-name {
		display: block;
		margin-right: 1rem;
		font-family: var(--font-head);
	}
	.preview-meta {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.preview-link {
		display: inline-block;
		margin-top: var(--space-2);
		font-weight: 600;
		color: var(--brand);
	}
	.count {
		color: var(--muted);
		font-size: var(--text-sm);
		margin: 0 0 var(--space-3);
	}
	.empty {
		text-align: center;
		padding: var(--space-6) var(--space-4);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		color: var(--muted);
	}
	.empty-title {
		font-weight: 700;
		color: var(--ink);
		margin: 0 0 var(--space-1);
	}
	.empty-desc {
		margin: 0 0 var(--space-2);
		font-size: var(--text-sm);
	}
	.route-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}
	.route-list li {
		/* Virtualización por CSS (SPECS_V4 §B6): el navegador omite el render y el
		   layout de las filas fuera de pantalla con ~600 rutas, pero el nodo sigue
		   en el DOM (búsqueda, anclas y scroll funcionan igual). `contain-intrinsic-
		   size` reserva la altura aproximada de cada fila para que la barra de
		   scroll no salte. */
		content-visibility: auto;
		contain-intrinsic-size: auto 76px;
	}
	.route-list a {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		background: var(--surface);
	}
	.route-list a:hover {
		border-color: var(--brand);
	}
	.row-top {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
	}
	.row-name {
		font-family: var(--font-head);
	}
	.meta {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.source {
		font-size: var(--text-xs);
		color: var(--muted);
	}
</style>
