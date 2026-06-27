<!--
  Badge de tipo de sendero (GR/PR/SL) con los colores fijos del sistema
  (contraste AA en claro y oscuro). aria-label expande el código al nombre
  completo para lectores de pantalla.
-->
<script lang="ts">
	import type { RouteType } from '$lib/types';
	import { routeTypeLabel } from './routeType';

	let { type }: { type: RouteType } = $props();
</script>

<span class="type-badge {type}" aria-label={routeTypeLabel(type)} title={routeTypeLabel(type)}>
	{type}
</span>

<style>
	.type-badge {
		display: inline-block;
		font-family: var(--font-head);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.04em;
		padding: 2px var(--space-2);
		border-radius: var(--radius-sm);
		line-height: 1.5;
	}
	.GR {
		background: var(--type-gr-bg);
		color: var(--type-gr-ink);
	}
	.PR {
		background: var(--type-pr-bg);
		color: var(--type-pr-ink);
	}
	.SL {
		background: var(--type-sl-bg);
		color: var(--type-sl-ink);
	}
</style>
