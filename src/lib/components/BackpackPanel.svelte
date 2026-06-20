<script lang="ts">
	import type { CustomGearDecision, GearDecision } from '$lib/types';

	let {
		decisions,
		checked = null,
		onToggle = null,
		customDecisions = []
	}: {
		decisions: GearDecision[];
		/** Checklist de preparación (SPECS_V2 §7); null = sin checklist. */
		checked?: ReadonlySet<string> | null;
		onToggle?: ((itemId: string) => void) | null;
		/** Material propio del usuario evaluado (SPECS_V3 §4); se gestiona en Ajustes. */
		customDecisions?: CustomGearDecision[];
	} = $props();

	let enabled = $derived(
		decisions
			.filter((d) => d.status === 'enabled')
			.sort((a, b) => Number(b.priority === 'alta') - Number(a.priority === 'alta'))
	);
	let indeterminate = $derived(decisions.filter((d) => d.status === 'indeterminate'));
	let disabled = $derived(decisions.filter((d) => d.status === 'disabled'));

	let totalWeightG = $derived(
		enabled.reduce((sum, d) => sum + (d.item.weight_g ?? 0), 0) +
			customDecisions.reduce((sum, d) => sum + (d.item.weight_g ?? 0), 0)
	);
</script>

<div class="backpack">
	<section>
		<h3>Llevar <span class="count">({enabled.length})</span></h3>
		<ul>
			{#each enabled as decision (decision.item.id)}
				<li class="item enabled" class:alta={decision.priority === 'alta'}>
					{#if checked && onToggle}
						<input
							type="checkbox"
							class="check"
							title="En la mochila"
							aria-label={`${decision.item.name} en la mochila`}
							checked={checked.has(decision.item.id)}
							onchange={() => onToggle?.(decision.item.id)}
						/>
					{/if}
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
						{#if checked && onToggle}
							<input
								type="checkbox"
								class="check"
								title="En la mochila"
								aria-label={`${decision.item.name} en la mochila`}
								checked={checked.has(decision.item.id)}
								onchange={() => onToggle?.(decision.item.id)}
							/>
						{/if}
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
					<li class="item disabled" class:still-checked={checked?.has(decision.item.id)}>
						{#if checked && onToggle}
							<input
								type="checkbox"
								class="check"
								title="En la mochila"
								aria-label={`${decision.item.name} en la mochila`}
								checked={checked.has(decision.item.id)}
								onchange={() => onToggle?.(decision.item.id)}
							/>
						{/if}
						<span class="name">{decision.item.name}</span>
						{#if checked?.has(decision.item.id)}
							<span class="still-warn">Sigue marcado en tu mochila aunque ya no se recomienda.</span
							>
						{/if}
						{#if decision.reason}<span class="reason">{decision.reason}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if customDecisions.length > 0}
		<section>
			<h3>Tu material <span class="count">({customDecisions.length})</span></h3>
			<ul>
				{#each customDecisions as d (d.item.id)}
					<li class="item custom" class:warn={d.status === 'warn'}>
						<span class="name">{d.item.name}</span>
						{#if d.status === 'warn' && d.reason}
							<span class="reason warn-reason">⚠️ {d.reason}</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="custom-hint">Gestiona tu material en Ajustes → Mi material.</p>
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
		color: var(--muted);
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
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.45rem 0.7rem;
		background: var(--surface);
		display: flex;
		flex-direction: column;
	}
	.item.enabled {
		border-left: 4px solid var(--brand);
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
	.item.custom {
		border-left: 4px solid var(--brand);
	}
	.item.custom.warn {
		border-left-color: var(--alert-border);
	}
	.warn-reason {
		color: var(--alert-ink);
	}
	.custom-hint {
		font-size: 0.78rem;
		color: var(--muted);
		margin: 0.35rem 0 0;
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
		color: var(--muted);
	}
	.check {
		margin: 0 0 0.2rem;
		align-self: start;
	}
	.item {
		position: relative;
	}
	.item :global(input.check) {
		position: absolute;
		right: 0.6rem;
		top: 0.55rem;
	}
	.still-warn {
		color: #8a5a00;
		font-size: 0.78rem;
	}
	.item.disabled.still-checked {
		opacity: 0.9;
		border-left: 4px solid #b8860b;
	}
	.weight {
		font-size: 0.82rem;
		color: var(--muted);
		margin: 0.4rem 0 0;
	}
</style>
