<script lang="ts">
	import { STATUS_LABELS, STATUS_TONE } from '$lib/status';
	import type { RouteStatus } from '$lib/types';

	let { status, detail = null }: { status: RouteStatus; detail?: string | null } = $props();
</script>

<span class="badge {STATUS_TONE[status]}" title={detail ?? STATUS_LABELS[status]}>
	{STATUS_LABELS[status]}
</span>

<style>
	/* Tonos derivados de los tokens del sistema (v6): funciona en los 9 esquemas
	   y en claro/oscuro, sin colores fijos. */
	.badge {
		display: inline-block;
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 2px var(--space-2);
		border-radius: var(--radius-pill);
		border: 1px solid transparent;
		white-space: nowrap;
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
	.neutral {
		background: var(--surface-alt);
		color: var(--muted-strong, var(--muted));
		border-color: var(--border);
	}
	.danger {
		background: var(--danger-soft);
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 30%, transparent);
	}
</style>
