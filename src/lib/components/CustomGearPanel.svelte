<script lang="ts">
	/**
	 * Material custom del usuario en la ficha de ruta (SPECS_V3 §4). Lista los
	 * ítems añadidos, los evalúa contra la ruta y la meteo del día y desaconseja
	 * (`warn`) los inadecuados con su motivo (p. ej. abrigo con calor). Permite
	 * añadir y quitar ítems; persiste en localStorage.
	 */
	import { onMount } from 'svelte';
	import type { GearAttribute, Route, Season, WeatherDay } from '$lib/types';
	import { ATTRIBUTE_LABELS, ATTRIBUTE_WARNING_RULES, GEAR_ATTRIBUTES } from '$lib/engine';
	import { evaluateCustomGear } from '$lib/engine';
	import {
		addCustomItem,
		emptyCustomGearData,
		loadCustomGear,
		removeCustomItem,
		saveCustomGear,
		type CustomGearData
	} from '$lib/user/customGear';

	let {
		route,
		weather,
		season
	}: {
		route: Route;
		weather: WeatherDay | null;
		season: Season;
	} = $props();

	let data = $state<CustomGearData>(emptyCustomGearData());
	onMount(() => {
		data = loadCustomGear();
	});

	let decisions = $derived(
		evaluateCustomGear(route, weather, season, data.items, ATTRIBUTE_WARNING_RULES)
	);

	// Formulario de alta.
	let name = $state('');
	let category = $state('ropa');
	let weight = $state('');
	let attrs = $state<GearAttribute[]>([]);

	const CATEGORIES = ['ropa', 'calzado', 'agua', 'seguridad', 'otros'];

	function toggleAttr(a: GearAttribute) {
		attrs = attrs.includes(a) ? attrs.filter((x) => x !== a) : [...attrs, a];
	}

	function add() {
		const trimmed = name.trim();
		if (!trimmed) return;
		const grams = weight.trim() === '' ? null : Number(weight.replace(',', '.'));
		data = addCustomItem(data, {
			name: trimmed,
			category,
			weight_g: grams !== null && Number.isFinite(grams) && grams >= 0 ? grams : null,
			attributes: attrs
		});
		saveCustomGear(data);
		name = '';
		weight = '';
		attrs = [];
	}

	function remove(id: string) {
		data = removeCustomItem(data, id);
		saveCustomGear(data);
	}
</script>

<section class="custom-gear">
	<h3>Tu material <span class="count">({data.items.length})</span></h3>

	{#if decisions.length > 0}
		<ul>
			{#each decisions as d (d.item.id)}
				<li class="item" class:warn={d.status === 'warn'}>
					<div class="row">
						<span class="name">{d.item.name}</span>
						<button
							type="button"
							class="remove"
							aria-label={`Quitar ${d.item.name}`}
							onclick={() => remove(d.item.id)}>×</button
						>
					</div>
					{#if d.item.attributes.length > 0}
						<span class="attrs">
							{d.item.attributes.map((a) => ATTRIBUTE_LABELS[a]).join(' · ')}
						</span>
					{/if}
					{#if d.status === 'warn' && d.reason}
						<span class="reason" role="status">⚠️ {d.reason}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Añade tu propio material para que se tenga en cuenta en esta ruta.</p>
	{/if}

	<form
		class="add"
		onsubmit={(e) => {
			e.preventDefault();
			add();
		}}
	>
		<div class="fields">
			<label>
				Nombre
				<input type="text" bind:value={name} placeholder="Calcetines impermeables" />
			</label>
			<label>
				Categoría
				<select bind:value={category}>
					{#each CATEGORIES as c (c)}
						<option value={c}>{c}</option>
					{/each}
				</select>
			</label>
			<label>
				Peso (g)
				<input type="text" inputmode="numeric" bind:value={weight} placeholder="90" />
			</label>
		</div>
		<fieldset class="attrs-pick">
			<legend>Atributos</legend>
			{#each GEAR_ATTRIBUTES as a (a)}
				<label class="chip">
					<input type="checkbox" checked={attrs.includes(a)} onchange={() => toggleAttr(a)} />
					{ATTRIBUTE_LABELS[a]}
				</label>
			{/each}
		</fieldset>
		<button type="submit" class="add-btn" disabled={name.trim() === ''}>Añadir a mi material</button
		>
	</form>
</section>

<style>
	.custom-gear {
		margin-top: 1rem;
	}
	h3 {
		margin: 0 0 0.4rem;
	}
	.count {
		font-weight: 400;
		color: var(--muted);
		font-size: 0.85rem;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0 0 0.8rem;
		display: grid;
		gap: 0.35rem;
	}
	.item {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.45rem 0.7rem;
		background: var(--surface);
		display: flex;
		flex-direction: column;
	}
	.item.warn {
		border-left: 4px solid #b8860b;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.name {
		font-weight: 600;
	}
	.attrs {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.reason {
		font-size: 0.82rem;
		color: #8a5a00;
		margin-top: 0.2rem;
	}
	.empty {
		color: var(--muted);
		font-size: 0.88rem;
	}
	.remove {
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0.2rem;
	}
	.add {
		border-top: 1px solid var(--border);
		padding-top: 0.6rem;
		display: grid;
		gap: 0.5rem;
	}
	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.fields label {
		display: flex;
		flex-direction: column;
		font-size: 0.8rem;
		color: var(--muted-strong);
		gap: 0.15rem;
	}
	.fields input,
	.fields select {
		padding: 0.3rem 0.4rem;
	}
	.attrs-pick {
		border: 1px solid var(--border);
		border-radius: 6px;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.7rem;
		padding: 0.4rem 0.6rem;
	}
	.attrs-pick legend {
		font-size: 0.8rem;
		color: var(--muted-strong);
	}
	.chip {
		font-size: 0.82rem;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.add-btn {
		justify-self: start;
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--brand);
		background: var(--brand);
		color: #fff;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
