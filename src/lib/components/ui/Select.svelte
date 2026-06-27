<!--
  Select del sistema. Bindable `value`. Las opciones las renderiza el padre como
  hijos (<option>). Pensado para Field (id/describedBy/invalid).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		value: string;
		id?: string;
		disabled?: boolean;
		invalid?: boolean;
		describedBy?: string;
		'aria-label'?: string;
		onchange?: (e: Event) => void;
		children: Snippet;
	}

	let {
		value = $bindable(),
		id,
		disabled = false,
		invalid = false,
		describedBy,
		'aria-label': ariaLabel,
		onchange,
		children
	}: Props = $props();
</script>

<div class="select-wrap">
	<select
		class="select"
		{id}
		{disabled}
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
		aria-label={ariaLabel}
		bind:value
		{onchange}
	>
		{@render children()}
	</select>
	<span class="chevron" aria-hidden="true">▾</span>
</div>

<style>
	.select-wrap {
		position: relative;
		display: inline-flex;
		width: 100%;
	}
	.select {
		appearance: none;
		font-family: var(--font-body);
		font-size: var(--text-base);
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0 var(--space-6) 0 var(--space-3);
		min-height: var(--touch-min);
		width: 100%;
		cursor: pointer;
	}
	.select:hover:not(:disabled) {
		border-color: var(--brand-line);
	}
	.select[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.chevron {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: var(--muted);
		font-size: var(--text-sm);
	}
</style>
