<script lang="ts">
	import { onMount } from 'svelte';
	import {
		emptyUserData,
		isDone,
		TOGGLE_MARKS,
		withOuting,
		withoutOuting,
		withToggledMark,
		type ToggleMark,
		type UserData
	} from '$lib/user/marks';
	import { getUserRepository } from '$lib/user/context';

	let { routeId }: { routeId: string } = $props();

	const repo = getUserRepository();

	const MARK_LABELS: Record<ToggleMark, { off: string; on: string }> = {
		favorita: { off: '☆ Favorita', on: '★ Favorita' },
		me_gusta: { off: '♡ Me gusta', on: '♥ Me gusta' },
		quiero_hacer: { off: '+ Quiero hacerla', on: '✓ Quiero hacerla' }
	};

	let userData = $state<UserData>(emptyUserData());
	let showOutingForm = $state(false);
	let outingDate = $state(new Date().toISOString().slice(0, 10));
	let outingNotes = $state('');

	onMount(() => {
		userData = repo.loadMarks();
	});

	let marks = $derived(userData.marks[routeId] ?? {});

	function persist(next: UserData) {
		userData = next;
		repo.saveMarks(next);
	}

	function toggle(mark: ToggleMark) {
		persist(withToggledMark(userData, routeId, mark));
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
	}

	function removeOuting(index: number) {
		persist(withoutOuting(userData, routeId, index));
	}
</script>

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
		{isDone(marks) ? `Hecha ×${marks.outings!.length}` : 'Registrar salida'}
	</button>
</div>

{#if showOutingForm}
	<form
		class="outing-form"
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
	{#if (marks.outings?.length ?? 0) > 0}
		<ul class="outings">
			{#each marks.outings ?? [] as outing, index (outing.date + index)}
				<li>
					{outing.date}{outing.notes ? ` — ${outing.notes}` : ''}
					<button type="button" class="remove" onclick={() => removeOuting(index)}> Borrar </button>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

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
