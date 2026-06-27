<!--
  Banner / aviso del sistema (info / ok / warn / alerta). Para meteo, avisos
  AEMET/CAP, riesgo de incendio, errores de lo online con reintento, etc.
  Opcionalmente muestra un título, un icono (emoji) y una zona de acciones.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'info' | 'ok' | 'warn' | 'alert';

	interface Props {
		tone?: Tone;
		title?: string;
		/** Emoji o glifo a la izquierda (decorativo). */
		icon?: string;
		/** Rol ARIA: 'alert' para errores/avisos urgentes, 'status' para el resto. */
		role?: 'alert' | 'status' | 'note';
		actions?: Snippet;
		children?: Snippet;
	}

	let { tone = 'info', title, icon, role = 'status', actions, children }: Props = $props();
</script>

<div class="banner {tone}" role={role === 'note' ? undefined : role}>
	{#if icon}<span class="icon" aria-hidden="true">{icon}</span>{/if}
	<div class="content">
		{#if title}<p class="title">{title}</p>{/if}
		{#if children}<div class="text">{@render children()}</div>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		font-size: var(--text-sm);
	}
	.icon {
		font-size: var(--text-md);
		line-height: 1.4;
		flex-shrink: 0;
	}
	.content {
		flex: 1;
		min-width: 0;
	}
	.title {
		margin: 0 0 2px;
		font-weight: 700;
		font-size: var(--text-sm);
	}
	.text {
		color: inherit;
	}
	.text :global(p) {
		margin: 0;
	}
	.actions {
		flex-shrink: 0;
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.info {
		background: var(--brand-soft);
		color: var(--ink);
		border-color: var(--brand-line);
	}
	.ok {
		background: var(--ok-soft);
		color: var(--ink);
		border-color: color-mix(in srgb, var(--ok) 35%, transparent);
	}
	.warn {
		background: var(--warn-soft);
		color: var(--ink);
		border-color: color-mix(in srgb, var(--warn) 38%, transparent);
	}
	.alert {
		background: var(--alert-soft, var(--alert-bg));
		color: var(--alert-ink, var(--ink));
		border-color: var(--alert-border);
	}
</style>
