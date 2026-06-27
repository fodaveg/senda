<!--
  Chip de filtro activo y quitable (variante A del descubrimiento). Muestra la
  etiqueta del filtro y un botón ✕ para retirarlo. Si no se pasa `onRemove`, es
  un chip estático (no quitable). El botón de quitar lleva aria-label explícito.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Etiqueta accesible del filtro (para el aria-label del ✕). */
		label?: string;
		onRemove?: () => void;
		children: Snippet;
	}

	let { label, onRemove, children }: Props = $props();
</script>

<span class="chip" class:removable={!!onRemove}>
	<span class="text">{@render children()}</span>
	{#if onRemove}
		<button
			type="button"
			class="remove"
			aria-label={label ? `Quitar filtro: ${label}` : 'Quitar filtro'}
			onclick={onRemove}>✕</button
		>
	{/if}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		background: var(--brand-soft);
		color: var(--brand);
		border: 1px solid var(--brand-line);
		border-radius: var(--radius-pill);
		font-size: var(--text-sm);
		font-weight: 600;
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
		max-width: 100%;
	}
	.chip:not(.removable) {
		padding-right: var(--space-3);
	}
	.text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		color: inherit;
		border-radius: var(--radius-pill);
		cursor: pointer;
		font-size: var(--text-xs);
		line-height: 1;
		flex-shrink: 0;
	}
	.remove:hover {
		background: color-mix(in srgb, var(--brand) 22%, transparent);
	}
</style>
