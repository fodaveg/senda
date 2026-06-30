<script lang="ts">
	import { onMount } from 'svelte';
	import {
		emptyUserData,
		isDone,
		liveOutings,
		TOGGLE_MARKS,
		withOuting,
		withoutOuting,
		withToggledMark,
		type ToggleMark,
		type UserData
	} from '$lib/user/marks';
	import { getUserRepository } from '$lib/user/context';
	import { getAnalytics } from '$lib/analytics/context';
	import { routeEvent } from '$lib/analytics/events';

	// `compact`: variante de cabecera de ficha (handoff v6) → botones-icono.
	let { routeId, compact = false }: { routeId: string; compact?: boolean } = $props();

	const repo = getUserRepository();
	const analytics = getAnalytics();

	const MARK_LABELS: Record<ToggleMark, { off: string; on: string }> = {
		favorita: { off: '☆ Favorita', on: '★ Favorita' },
		me_gusta: { off: '♡ Me gusta', on: '♥ Me gusta' },
		quiero_hacer: { off: '+ Quiero hacerla', on: '✓ Quiero hacerla' }
	};

	// En modo compacto se muestran solo las acciones de la cabecera del diseño:
	// favorita, quiero hacer y registrar salida (sin "me gusta"), como iconos.
	const COMPACT_MARKS: { mark: ToggleMark; off: string; on: string; label: string }[] = [
		{ mark: 'favorita', off: '♡', on: '♥', label: 'Favorita' },
		{ mark: 'quiero_hacer', off: '✓', on: '✓', label: 'Quiero hacerla' }
	];

	let userData = $state<UserData>(emptyUserData());
	let showOutingForm = $state(false);
	let outingDate = $state(new Date().toISOString().slice(0, 10));
	let outingNotes = $state('');

	onMount(() => {
		userData = repo.loadMarks();
	});

	let marks = $derived(userData.marks[routeId] ?? {});
	let outings = $derived(liveOutings(marks));

	function persist(next: UserData) {
		userData = next;
		repo.saveMarks(next);
	}

	function toggle(mark: ToggleMark) {
		const willBeOn = !marks[mark];
		persist(withToggledMark(userData, routeId, mark));
		// Analítica anónima opt-in: solo al marcar (no al desmarcar) una favorita.
		if (willBeOn && mark === 'favorita') analytics.track(routeEvent('favorita', routeId));
	}

	function registerOuting() {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(outingDate)) return;
		persist(
			withOuting(userData, routeId, {
				date: outingDate,
				...(outingNotes.trim() ? { notes: outingNotes.trim() } : {})
			})
		);
		showOutingForm = false;
		outingNotes = '';
		// Analítica anónima opt-in: ruta completada (sin fecha ni notas, solo el id).
		analytics.track(routeEvent('completada', routeId));
	}

	function removeOuting(outingId: string) {
		persist(withoutOuting(userData, routeId, outingId));
	}
</script>

<div class="route-marks" class:compact>
	{#if compact}
		<div class="marks compact">
			{#each COMPACT_MARKS as m (m.mark)}
				<button
					type="button"
					class="ic-btn"
					class:active={marks[m.mark]}
					aria-pressed={!!marks[m.mark]}
					aria-label={m.label}
					title={m.label}
					onclick={() => toggle(m.mark)}
				>
					<span aria-hidden="true">{marks[m.mark] ? m.on : m.off}</span>
				</button>
			{/each}
			<button
				type="button"
				class="ic-btn"
				class:active={isDone(marks)}
				aria-pressed={showOutingForm}
				aria-label={isDone(marks) ? `Salidas registradas: ${outings.length}` : 'Registrar salida'}
				title="Registrar salida"
				onclick={() => (showOutingForm = !showOutingForm)}
			>
				<span aria-hidden="true">⌖</span>
			</button>
		</div>
	{:else}
		<div class="marks">
			{#each TOGGLE_MARKS as mark (mark)}
				<button
					type="button"
					class:active={marks[mark]}
					aria-pressed={!!marks[mark]}
					onclick={() => toggle(mark)}
				>
					{marks[mark] ? MARK_LABELS[mark].on : MARK_LABELS[mark].off}
				</button>
			{/each}
			<button
				type="button"
				class:active={isDone(marks)}
				onclick={() => (showOutingForm = !showOutingForm)}
			>
				{isDone(marks) ? `Hecha ×${outings.length}` : 'Registrar salida'}
			</button>
		</div>
	{/if}

	{#if showOutingForm}
		<form
			class="outing-form"
			class:compact
			onsubmit={(e) => {
				e.preventDefault();
				registerOuting();
			}}
		>
			<label>
				Fecha
				<input type="date" bind:value={outingDate} required />
			</label>
			<label class="grow">
				Notas (opcional)
				<input type="text" bind:value={outingNotes} placeholder="Con quién, cómo fue…" />
			</label>
			<button type="submit">Guardar salida</button>
		</form>
		{#if outings.length > 0}
			<ul class="outings">
				{#each outings as outing (outing.id)}
					<li>
						{outing.date}{outing.notes ? ` — ${outing.notes}` : ''}
						<button type="button" class="remove" onclick={() => removeOuting(outing.id)}>
							Borrar
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.marks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.5rem 0 1rem;
	}
	.marks button {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		cursor: pointer;
	}
	.marks button.active {
		border-color: var(--brand);
		background: var(--surface-alt);
		color: var(--brand);
		font-weight: 600;
	}
	/* Variante compacta (cabecera de ficha v6): botones-icono + formulario en
	   menú flotante anclado al grupo. */
	.route-marks.compact {
		position: relative;
	}
	.marks.compact {
		gap: var(--space-1);
		margin: 0;
	}
	.ic-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		font-size: var(--text-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
		line-height: 1;
	}
	.ic-btn:hover {
		background: var(--surface-alt);
	}
	.ic-btn.active {
		border-color: var(--brand);
		background: var(--brand-soft, var(--surface-alt));
		color: var(--brand);
	}
	.outing-form.compact {
		position: absolute;
		top: calc(100% + var(--space-1));
		left: 0;
		z-index: 20;
		width: min(340px, 90vw);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
		margin: 0;
	}
	.outing-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: end;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.6rem 0.85rem;
		margin-bottom: 0.75rem;
	}
	.outing-form label {
		display: grid;
		gap: 0.2rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.outing-form .grow {
		flex: 1;
		min-width: 12rem;
	}
	.outing-form input {
		font: inherit;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.outing-form button {
		font: inherit;
		padding: 0.4rem 0.9rem;
		border-radius: 6px;
		border: 1px solid var(--brand);
		background: var(--brand);
		color: var(--on-brand);
		cursor: pointer;
	}
	.outings {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: var(--muted-strong);
		display: grid;
		gap: 0.25rem;
	}
	.remove {
		font: inherit;
		font-size: 0.75rem;
		margin-left: 0.5rem;
		border: none;
		background: none;
		color: #b3261e;
		cursor: pointer;
		text-decoration: underline;
	}
</style>
