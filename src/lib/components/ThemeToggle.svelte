<script lang="ts">
	/**
	 * Conmutador de tema en la barra superior (SPECS_V3 §9, pulido v3). Cicla entre
	 * los tres modos: **claro → oscuro → automático → claro…**. Atajo del ajuste
	 * `theme`; la galería de esquemas por modo sigue en Ajustes. Persiste en
	 * localStorage y aplica el tema al instante. "Automático" sigue la preferencia
	 * del sistema.
	 */
	import { onMount } from 'svelte';
	import type { Theme } from '$lib/settings';
	import { applyAppearance } from '$lib/theme/schemes';
	import { getUserRepository } from '$lib/user/context';

	const repo = getUserRepository();

	const ORDER: Theme[] = ['claro', 'oscuro', 'auto'];
	const ICON: Record<Theme, string> = { claro: '☀️', oscuro: '🌙', auto: '🌗' };
	const LABEL: Record<Theme, string> = { claro: 'claro', oscuro: 'oscuro', auto: 'automático' };

	let theme = $state<Theme>('auto');

	onMount(() => {
		theme = repo.loadSettings().theme;
	});

	/** Avanza al siguiente modo del ciclo y lo persiste/aplica. */
	function cycle() {
		const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
		theme = next;
		const settings = repo.loadSettings();
		settings.theme = next;
		repo.saveSettings(settings);
		applyAppearance(settings);
	}
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={cycle}
	aria-label="Cambiar modo de color"
	title={`Tema: ${LABEL[theme]} (clic para cambiar)`}
>
	<span aria-hidden="true">{ICON[theme]}</span>
	<span class="mode">{LABEL[theme]}</span>
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
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
	.mode {
		font-size: 0.75rem;
		text-transform: capitalize;
	}
	@media (max-width: 30rem) {
		.mode {
			display: none;
		}
	}
</style>
