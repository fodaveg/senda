<!--
  Badge genérico por "tono" semántico (neutral / ok / warn / danger / brand /
  info). Token-based, así que funciona con los 9 esquemas. Para estado de
  homologación o tipo de sendero hay componentes específicos (StatusBadge /
  TypeBadge); este cubre el resto de etiquetas (fuente, "sin verificar", etc.).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brand' | 'info';

	interface Props {
		tone?: Tone;
		/** Variante con borde fino y fondo "soft" (por defecto) o sólido tenue. */
		title?: string;
		children: Snippet;
	}

	let { tone = 'neutral', title, children }: Props = $props();
</script>

<span class="badge {tone}" {title}>{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-xs);
		font-weight: 600;
		padding: 2px var(--space-2);
		border-radius: var(--radius-pill);
		border: 1px solid transparent;
		line-height: 1.5;
		white-space: nowrap;
	}
	.neutral {
		background: var(--surface-alt);
		color: var(--muted-strong, var(--muted));
		border-color: var(--border);
	}
	.brand {
		background: var(--brand-soft);
		color: var(--brand);
		border-color: var(--brand-line);
	}
	.info {
		background: var(--brand-soft);
		color: var(--brand);
		border-color: var(--brand-line);
	}
	.ok {
		background: var(--ok-soft);
		color: var(--ok);
		border-color: color-mix(in srgb, var(--ok) 30%, transparent);
	}
	.warn {
		background: var(--warn-soft);
		color: var(--warn);
		border-color: color-mix(in srgb, var(--warn) 30%, transparent);
	}
	.danger {
		background: var(--danger-soft);
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 30%, transparent);
	}
</style>
