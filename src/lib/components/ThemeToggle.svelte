<script lang="ts">
	/**
	 * Conmutador rápido de tema en la barra superior (SPECS_V3 §9). Atajo del
	 * ajuste `theme` ya existente: alterna claro↔oscuro de forma explícita (si
	 * estaba en "auto", pasa a oscuro). La elección completa (incluido "auto")
	 * sigue en Ajustes. Persiste en localStorage y aplica el tema al instante.
	 */
	import { onMount } from 'svelte';
	import { prefersDark, type Theme } from '$lib/settings';
	import { applyAppearance } from '$lib/theme/schemes';
	import { getUserRepository } from '$lib/user/context';

	const repo = getUserRepository();

	let theme = $state<Theme>('auto');

	onMount(() => {
		theme = repo.loadSettings().theme;
	});

	// Aspecto EFECTIVO actual (resolviendo "auto" con el sistema): así el primer
	// clic siempre cambia lo que se ve, no el string guardado.
	let currentlyDark = $derived(theme === 'oscuro' || (theme === 'auto' && prefersDark()));

	function toggle() {
		const next: Theme = currentlyDark ? 'claro' : 'oscuro';
		theme = next;
		const settings = repo.loadSettings();
		settings.theme = next;
		repo.saveSettings(settings);
		applyAppearance(settings); // aplica el esquema del nuevo modo
	}
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={toggle}
	aria-label={currentlyDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
	title={currentlyDark ? 'Modo claro' : 'Modo oscuro'}
>
	{currentlyDark ? '☀️' : '🌙'}
</button>

<style>
	.theme-toggle {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.5);
		color: #fff;
		border-radius: 0.4rem;
		padding: 0.2rem 0.5rem;
		font-size: 0.95rem;
		line-height: 1;
		cursor: pointer;
	}
	.theme-toggle:hover {
		background: rgba(255, 255, 255, 0.14);
	}
</style>
