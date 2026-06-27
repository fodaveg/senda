<!--
  Casilla de verificación del sistema, con etiqueta a la derecha. Bindable
  `checked`. Usa un <input type="checkbox"> nativo (accesible) revestido.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		checked: boolean;
		disabled?: boolean;
		id?: string;
		onchange?: (checked: boolean) => void;
		children: Snippet;
	}

	let { checked = $bindable(), disabled = false, id, onchange, children }: Props = $props();
</script>

<label class="checkbox" class:disabled>
	<input type="checkbox" {id} {disabled} bind:checked onchange={() => onchange?.(checked)} />
	<span class="text">{@render children()}</span>
</label>

<style>
	.checkbox {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		font-size: var(--text-sm);
		min-height: var(--touch-min);
	}
	.checkbox.disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	input {
		width: 18px;
		height: 18px;
		accent-color: var(--brand);
		cursor: inherit;
		flex-shrink: 0;
	}
</style>
