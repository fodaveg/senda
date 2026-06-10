<script lang="ts">
	import type { GearDecision } from '$lib/types';

	let { decisions }: { decisions: GearDecision[] } = $props();

	let enabled = $derived(
		decisions
			.filter((d) => d.status === 'enabled')
			.sort((a, b) => Number(b.priority === 'alta') - Number(a.priority === 'alta'))
	);
	let indeterminate = $derived(decisions.filter((d) => d.status === 'indeterminate'));
	let disabled = $derived(decisions.filter((d) => d.status === 'disabled'));

	let totalWeightG = $derived(enabled.reduce((sum, d) => sum + (d.item.weight_g ?? 0), 0));
</script>

<div class="backpack">
	<section>
		<h3>Llevar <span class="count">({enabled.length})</span></h3>
		<ul>
			{#each enabled as decision (decision.item.id)}
				<li class="item enabled" class:alta={decision.priority === 'alta'}>
					<span class="name">
						{decision.item.name}
						{#if decision.priority === 'alta'}<span class="prio">prioridad alta</span>{/if}
					</span>
					{#if decision.reason}<span class="reason">{decision.reason}</span>{/if}
				</li>
			{/each}
		</ul>
		<p class="weight">Peso aproximado: {(totalWeightG / 1000).toLocaleString('es-ES')} kg</p>
	</section>

	{#if indeterminate.length > 0}
		<section>
			<h3>A tu criterio <span class="count">({indeterminate.length})</span></h3>
			<ul>
				{#each indeterminate as decision (decision.item.id)}
					<li class="item indeterminate">
						<span class="name">? {decision.item.name}</span>
						{#if decision.reason}<span class="reason">{decision.reason}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if disabled.length > 0}
		<section>
			<h3>Puedes dejarlo <span class="count">({disabled.length})</span></h3>
			<ul>
				{#each disabled as decision (decision.item.id)}
					<li class="item disabled">
						<span class="name">{decision.item.name}</span>
						{#if decision.reason}<span class="reason">{decision.reason}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.backpack section + section {
		margin-top: 1rem;
	}
	h3 {
		margin: 0 0 0.4rem;
	}
	.count {
		font-weight: 400;
		color: #555;
		font-size: 0.85rem;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}
	.item {
		border: 1px solid #d8d4c8;
		border-radius: 6px;
		padding: 0.45rem 0.7rem;
		background: #fff;
		display: flex;
		flex-direction: column;
	}
	.item.enabled {
		border-left: 4px solid #2a6f4e;
	}
	.item.enabled.alta {
		border-left-color: #b3261e;
	}
	.item.indeterminate {
		opacity: 0.65;
		border-style: dashed;
	}
	.item.disabled {
		opacity: 0.55;
	}
	.item.disabled .name {
		text-decoration: line-through;
	}
	.name {
		font-weight: 600;
	}
	.prio {
		font-weight: 700;
		color: #b3261e;
		font-size: 0.75rem;
		margin-left: 0.4rem;
		text-transform: uppercase;
	}
	.reason {
		font-size: 0.82rem;
		color: #555;
	}
	.weight {
		font-size: 0.82rem;
		color: #555;
		margin: 0.4rem 0 0;
	}
</style>
