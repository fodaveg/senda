<script lang="ts">
	/**
	 * Lista de etapas de una ruta multi-día (SPECS_V3 §6). Cada etapa es una
	 * ruta navegable por sí misma.
	 */
	import { resolve } from '$app/paths';
	import type { StageRef } from '$lib/data/stages';

	let { stages }: { stages: StageRef[] } = $props();
</script>

<ol class="stages">
	{#each stages as stage (stage.id)}
		<li>
			<a href={resolve('/ruta/[id]', { id: stage.id })}>
				<span class="num">Etapa {stage.order}</span>
				<span class="name">{stage.name}</span>
			</a>
		</li>
	{/each}
</ol>

<style>
	.stages {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
		counter-reset: none;
	}
	.stages a {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.4rem 0.7rem;
		background: var(--surface);
		text-decoration: none;
		color: inherit;
	}
	.stages a:hover {
		border-color: var(--brand);
	}
	.num {
		font-size: 0.75rem;
		color: var(--muted);
		text-transform: uppercase;
	}
	.name {
		font-weight: 600;
	}
</style>
