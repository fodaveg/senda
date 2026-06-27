<!--
  Tarjeta del sistema de diseño v6: superficie con borde, radio y padding
  coherentes. `pad` controla el espaciado interno; `elevated` añade sombra.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		pad?: 'none' | 'sm' | 'md' | 'lg';
		elevated?: boolean;
		/** Etiqueta semántica del contenedor (por defecto <div>). */
		as?: 'div' | 'article' | 'section' | 'li';
		class?: string;
		children: Snippet;
	}

	let { pad = 'md', elevated = false, as = 'div', class: klass = '', children }: Props = $props();
</script>

<svelte:element this={as} class="card pad-{pad} {klass}" class:elevated>
	{@render children()}
</svelte:element>

<style>
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	.elevated {
		box-shadow: var(--shadow-md);
	}
	.pad-sm {
		padding: var(--space-3);
	}
	.pad-md {
		padding: var(--space-4);
	}
	.pad-lg {
		padding: var(--space-5);
	}
</style>
