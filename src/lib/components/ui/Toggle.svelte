<!--
  Conmutador (switch) accesible. Bindable `checked`. Usa role="switch" sobre un
  botón; la etiqueta visible se pasa como children y queda a la izquierda.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		checked: boolean;
		disabled?: boolean;
		id?: string;
		'aria-label'?: string;
		onchange?: (checked: boolean) => void;
		children?: Snippet;
	}

	let {
		checked = $bindable(),
		disabled = false,
		id,
		'aria-label': ariaLabel,
		onchange,
		children
	}: Props = $props();

	function toggle() {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
	}
</script>

<label class="toggle" class:disabled>
	{#if children}<span class="label">{@render children()}</span>{/if}
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={ariaLabel}
		{id}
		{disabled}
		class="track"
		class:on={checked}
		onclick={toggle}
	>
		<span class="thumb"></span>
	</button>
</label>

<style>
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		cursor: pointer;
	}
	.toggle.disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.label {
		font-size: var(--text-sm);
	}
	.track {
		position: relative;
		width: 44px;
		height: 26px;
		flex-shrink: 0;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border);
		background: var(--surface-alt);
		cursor: inherit;
		padding: 0;
		transition: background-color 0.15s ease;
	}
	.track.on {
		background: var(--brand);
		border-color: var(--brand);
	}
	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		transition: transform 0.15s ease;
	}
	.track.on .thumb {
		transform: translateX(18px);
		background: var(--on-brand);
	}
	@media (prefers-reduced-motion: reduce) {
		.track,
		.thumb {
			transition: none;
		}
	}
</style>
