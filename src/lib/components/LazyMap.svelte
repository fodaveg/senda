<script lang="ts">
	/**
	 * Carga perezosa del mapa (SPECS_V4 §B6, code-splitting). `Map.svelte` arrastra
	 * `maplibre-gl` (~500 kB), que no debe entrar en el chunk inicial de la página:
	 * aquí se importa de forma **dinámica** para que viva en su propio chunk async,
	 * y la página (listado, filtros) se renderiza al instante mientras el mapa
	 * carga. Reenvía todas las props a `Map.svelte` sin cambiar su contrato.
	 *
	 * La promesa del import se calcula una sola vez (no en el bloque `await`) para
	 * no reimportar en cada cambio de props; el `<MapComponent {...props}/>` sí
	 * reacciona a las props dentro del `then`.
	 */
	import type { ComponentProps } from 'svelte';
	import type MapType from './Map.svelte';

	let props: ComponentProps<typeof MapType> = $props();

	const mapModule = import('./Map.svelte');
</script>

{#await mapModule}
	<div class="map-loading" aria-busy="true">Cargando mapa…</div>
{:then { default: MapComponent }}
	<MapComponent {...props} />
{:catch}
	<p class="map-loading">Mapa no disponible.</p>
{/await}

<style>
	.map-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 320px;
		color: var(--muted-strong);
		background: var(--surface-alt);
	}
</style>
