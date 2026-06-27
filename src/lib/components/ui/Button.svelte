<!--
  Botón del sistema de diseño v6. Variantes: primario / secundario / fantasma /
  peligro. Estados: normal, hover, foco (anillo global), deshabilitado y
  cargando (spinner; bloquea la interacción). Polimórfico: si recibe `href` se
  renderiza como enlace (<a>) manteniendo el mismo aspecto.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	interface Props {
		variant?: Variant;
		size?: Size;
		/** Si se indica, el botón es un enlace de navegación con aspecto de botón. */
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		/** Muestra el spinner y bloquea la interacción. */
		loading?: boolean;
		/** Ocupa todo el ancho disponible. */
		block?: boolean;
		title?: string;
		'aria-label'?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		href,
		type = 'button',
		disabled = false,
		loading = false,
		block = false,
		title,
		'aria-label': ariaLabel,
		onclick,
		children
	}: Props = $props();

	// Un botón "cargando" no debe activarse de nuevo.
	const isDisabled = $derived(disabled || loading);
</script>

{#if href && !isDisabled}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- componente genérico: el consumidor pasa el href ya resuelto o uno externo -->
	<a class="btn {variant} {size}" class:block {href} {title} aria-label={ariaLabel} {onclick}>
		{@render children()}
	</a>
{:else}
	<button
		class="btn {variant} {size}"
		class:block
		class:loading
		{type}
		disabled={isDisabled}
		aria-busy={loading}
		{title}
		aria-label={ariaLabel}
		{onclick}
	>
		{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
		<span class="label">{@render children()}</span>
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-family: var(--font-body);
		font-weight: 600;
		font-size: var(--text-sm);
		line-height: 1;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		cursor: pointer;
		text-decoration: none;
		min-height: var(--touch-min);
		padding: 0 var(--space-4);
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.btn.sm {
		min-height: 34px;
		padding: 0 var(--space-3);
		font-size: var(--text-xs);
	}
	.btn.block {
		width: 100%;
	}

	.primary {
		background: var(--brand);
		color: var(--on-brand);
	}
	.primary:hover {
		background: color-mix(in srgb, var(--brand) 88%, black);
	}

	.secondary {
		background: var(--surface);
		color: var(--ink);
		border-color: var(--border);
	}
	.secondary:hover {
		background: var(--surface-alt);
	}

	.ghost {
		background: transparent;
		color: var(--brand);
	}
	.ghost:hover {
		background: var(--brand-soft);
	}

	.danger {
		background: var(--danger);
		color: var(--on-danger, #fff);
	}
	.danger:hover {
		background: color-mix(in srgb, var(--danger) 88%, black);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.btn.loading {
		cursor: progress;
	}

	.spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: btn-spin 0.7s linear infinite;
	}
	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 1.6s;
		}
		.btn {
			transition: none;
		}
	}
</style>
