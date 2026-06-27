<!--
  Navegación por secciones (pestañas). Dos estilos: `pill` (chips) y `underline`.
  Controlado: el padre pasa `active` y recibe `onChange`. Implementa el patrón
  ARIA tablist con navegación por flechas (← →) entre pestañas, para que cambiar
  de panel sea accesible por teclado. Los paneles los renderiza el padre.
-->
<script lang="ts">
	interface Tab {
		id: string;
		label: string;
		/** Emoji/glifo opcional antes de la etiqueta. */
		icon?: string;
	}

	interface Props {
		tabs: Tab[];
		active: string;
		variant?: 'pill' | 'underline';
		/** id base para enlazar tab↔panel (aria-controls = `${idBase}-panel-${id}`). */
		idBase?: string;
		'aria-label'?: string;
		onChange: (id: string) => void;
	}

	// eslint-disable-next-line svelte/no-unused-props -- la regla no detecta el uso de props renombradas con clave entrecomillada (aria-label → ariaLabel)
	let {
		tabs,
		active,
		variant = 'pill',
		idBase = 'tabs',
		'aria-label': ariaLabel = 'Secciones',
		onChange
	}: Props = $props();

	let buttons: HTMLButtonElement[] = $state([]);

	function onKeydown(e: KeyboardEvent, index: number) {
		let next: number;
		if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
		else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = tabs.length - 1;
		else return;
		e.preventDefault();
		onChange(tabs[next].id);
		buttons[next]?.focus();
	}
</script>

<div class="tabs {variant}" role="tablist" aria-label={ariaLabel}>
	{#each tabs as tab, i (tab.id)}
		<button
			bind:this={buttons[i]}
			type="button"
			role="tab"
			id="{idBase}-tab-{tab.id}"
			aria-selected={active === tab.id}
			aria-controls="{idBase}-panel-{tab.id}"
			tabindex={active === tab.id ? 0 : -1}
			class="tab"
			class:active={active === tab.id}
			onclick={() => onChange(tab.id)}
			onkeydown={(e) => onKeydown(e, i)}
		>
			{#if tab.icon}<span class="ic" aria-hidden="true">{tab.icon}</span>{/if}{tab.label}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		background: transparent;
		color: var(--muted-strong, var(--muted));
		border: 1px solid transparent;
		min-height: var(--touch-min);
	}

	/* Pill */
	.pill .tab {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-pill);
	}
	.pill .tab:hover {
		background: var(--surface-alt);
	}
	.pill .tab.active {
		background: var(--brand);
		color: var(--on-brand);
	}

	/* Underline */
	.underline {
		gap: var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.underline .tab {
		padding: var(--space-2) var(--space-1);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		border-radius: 0;
	}
	.underline .tab:hover {
		color: var(--ink);
	}
	.underline .tab.active {
		color: var(--brand);
		border-bottom-color: var(--brand);
	}
</style>
