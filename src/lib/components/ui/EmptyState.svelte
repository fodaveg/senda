<!--
  Estado vacío cuidado: icono opcional, título, descripción y una acción
  (p. ej. "Quitar filtros"). Para listados sin resultados, secciones sin datos,
  etc. Mensaje útil, nunca una pantalla en blanco.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		/** Emoji o glifo decorativo. */
		icon?: string;
		action?: Snippet;
		children?: Snippet;
	}

	let { title, description, icon, action, children }: Props = $props();
</script>

<div class="empty">
	{#if icon}<div class="icon" aria-hidden="true">{icon}</div>{/if}
	<p class="title">{title}</p>
	{#if description}<p class="desc">{description}</p>{/if}
	{#if children}{@render children()}{/if}
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-4);
		color: var(--muted);
	}
	.icon {
		font-size: var(--text-2xl);
		opacity: 0.8;
	}
	.title {
		margin: 0;
		font-weight: 700;
		font-size: var(--text-md);
		color: var(--ink);
	}
	.desc {
		margin: 0;
		font-size: var(--text-sm);
		max-width: 42ch;
	}
	.action {
		margin-top: var(--space-2);
	}
</style>
