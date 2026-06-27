<!--
  Sección con cabecera: título (+ subtítulo opcional) y una zona de acciones a la
  derecha, sobre una tarjeta. Base de los módulos de la ficha de ruta (Resumen,
  Preparación, Meteo…). `id` permite anclar el índice lateral (variante B).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		/** Para anclas del índice / navegación interna. */
		id?: string;
		/** Nivel del encabezado para la jerarquía de lectores (por defecto h2). */
		level?: 2 | 3;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, subtitle, id, level = 2, actions, children }: Props = $props();
</script>

<section class="section" {id}>
	<header class="head">
		<div class="titles">
			{#if level === 2}
				<h2>{title}</h2>
			{:else}
				<h3>{title}</h3>
			{/if}
			{#if subtitle}<p class="sub">{subtitle}</p>{/if}
		</div>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</header>
	<div class="body">
		{@render children()}
	</div>
</section>

<style>
	.section {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		scroll-margin-top: var(--space-6);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}
	.titles {
		min-width: 0;
	}
	h2,
	h3 {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--ink);
	}
	.sub {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		flex-shrink: 0;
	}
	.body {
		min-width: 0;
	}
</style>
