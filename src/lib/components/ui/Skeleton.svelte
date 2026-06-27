<!--
  Placeholder de carga con shimmer. Tamaño configurable (ancho/alto) y forma
  (texto / bloque / círculo). Respeta prefers-reduced-motion (sin animación).
-->
<script lang="ts">
	interface Props {
		width?: string;
		height?: string;
		shape?: 'text' | 'block' | 'circle';
	}

	let { width = '100%', height, shape = 'text' }: Props = $props();

	// Altura por defecto según la forma.
	const h = $derived(
		height ?? (shape === 'text' ? '0.9em' : shape === 'circle' ? '40px' : '120px')
	);
	const w = $derived(shape === 'circle' ? h : width);
</script>

<span
	class="skeleton {shape}"
	style:width={w}
	style:height={h}
	aria-hidden="true"
	data-testid="skeleton"
></span>

<style>
	.skeleton {
		display: block;
		background: linear-gradient(
			90deg,
			var(--surface-alt) 25%,
			color-mix(in srgb, var(--surface-alt) 60%, var(--border)) 37%,
			var(--surface-alt) 63%
		);
		background-size: 400% 100%;
		animation: shimmer 1.4s ease infinite;
		border-radius: var(--radius-sm);
	}
	.text {
		border-radius: var(--radius-pill);
	}
	.circle {
		border-radius: 50%;
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: 0 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
		}
	}
</style>
