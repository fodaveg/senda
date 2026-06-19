<script lang="ts">
	/**
	 * Conmutador rápido de tema en la barra superior (SPECS_V3 §9). Atajo del
	 * ajuste `theme` ya existente: alterna claro↔oscuro de forma explícita (si
	 * estaba en "auto", pasa a oscuro). La elección completa (incluido "auto")
	 * sigue en Ajustes. Persiste en localStorage y aplica el tema al instante.
	 */
	import { onMount } from 'svelte';
	import { applyTheme, loadSettings, saveSettings, type Theme } from '$lib/settings';

	let theme = $state<Theme>('auto');

	onMount(() => {
		theme = loadSettings().theme;
	});

	// En oscuro, el botón ofrece volver a claro; en claro/auto, ir a oscuro.
	let nextIsDark = $derived(theme !== 'oscuro');

	function toggle() {
		const next: Theme = nextIsDark ? 'oscuro' : 'claro';
		theme = next;
		applyTheme(next);
		const settings = loadSettings();
		settings.theme = next;
		saveSettings(settings);
	}
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={toggle}
	aria-label={nextIsDark ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
	title={nextIsDark ? 'Modo oscuro' : 'Modo claro'}
>
	{nextIsDark ? '🌙' : '☀️'}
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
