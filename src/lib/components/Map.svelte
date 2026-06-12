<script lang="ts" module>
	let registeredProtocol = false;
</script>

<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { getStoredBinary } from '$lib/catalog/store';
	import { IGN_ATTRIBUTION, ignTileUrl } from '$lib/map/tiles';
	import { onMount } from 'svelte';
	import type { FeatureCollection } from 'geojson';
	import type { StyleSpecification } from 'maplibre-gl';

	export interface MapMarker {
		id: string;
		lat: number;
		lon: number;
		name: string;
	}

	let {
		track = null,
		markers = [],
		bbox = null,
		onMarkerClick,
		highlight = null
	}: {
		track?: FeatureCollection | null;
		markers?: MapMarker[];
		bbox?: [number, number, number, number] | null;
		onMarkerClick?: (id: string) => void;
		/** Punto resaltado [lon, lat] (hover del perfil de elevación). */
		highlight?: [number, number] | null;
	} = $props();

	let container: HTMLDivElement;
	let mapFailed = $state(false);
	let highlightMarker: maplibregl.Marker | null = null;
	let mapInstance: maplibregl.Map | null = null;
	let mapReady = $state(false);
	let markerHandles: maplibregl.Marker[] = [];

	// Marcadores reactivos: el listado filtrado cambia y el mapa le sigue.
	$effect(() => {
		const list = markers;
		if (!mapReady || !mapInstance) return;
		for (const handle of markerHandles) handle.remove();
		markerHandles = list.map((marker) => {
			const m = new maplibregl.Marker({ color: '#c1121f' })
				.setLngLat([marker.lon, marker.lat])
				.addTo(mapInstance!);
			m.getElement().setAttribute('title', marker.name);
			m.getElement().style.cursor = 'pointer';
			m.getElement().addEventListener('click', (e) => {
				e.stopPropagation();
				onMarkerClick?.(marker.id);
			});
			return m;
		});
	});

	// Reencuadre al cambiar el bbox del resultado filtrado.
	$effect(() => {
		const box = bbox;
		if (!mapReady || !mapInstance || !box) return;
		mapInstance.fitBounds(box, { padding: 48, animate: true, duration: 400 });
	});

	// Marcador efímero sincronizado con el hover del perfil (SPECS_V2 §13).
	$effect(() => {
		const point = highlight;
		if (!mapInstance) return;
		if (!point) {
			highlightMarker?.remove();
			highlightMarker = null;
			return;
		}
		if (!highlightMarker) {
			const el = document.createElement('div');
			el.className = 'profile-dot';
			el.style.cssText =
				'width:14px;height:14px;border-radius:50%;background:#1d3a2a;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.5)';
			highlightMarker = new maplibregl.Marker({ element: el }).setLngLat(point).addTo(mapInstance);
		} else {
			highlightMarker.setLngLat(point);
		}
	});

	// Base cartográfica: IGN España mapa raster (SPEC v1 §1, SPECS_V2 §11).
	// El protocolo ign:// resuelve primero el almacén local (mapa offline
	// descargado por ruta) y cae a la red del IGN.
	if (!registeredProtocol) {
		maplibregl.addProtocol('ign', async (params) => {
			const match = params.url.match(/^ign:\/\/(\d+)\/(\d+)\/(\d+)$/);
			if (!match) throw new Error(`URL de tile no válida: ${params.url}`);
			const [, z, x, y] = match;
			const stored = await getStoredBinary(`tiles/${z}/${x}/${y}`);
			if (stored) return { data: stored };
			const response = await fetch(ignTileUrl(Number(z), Number(x), Number(y)));
			if (!response.ok) throw new Error(`IGN respondió ${response.status}`);
			return { data: await response.arrayBuffer() };
		});
		registeredProtocol = true;
	}

	const style: StyleSpecification = {
		version: 8,
		sources: {
			ign: {
				type: 'raster',
				tiles: ['ign://{z}/{x}/{y}'],
				tileSize: 256,
				maxzoom: 17,
				attribution: IGN_ATTRIBUTION
			}
		},
		layers: [{ id: 'ign', type: 'raster', source: 'ign' }]
	};

	onMount(() => {
		let map: maplibregl.Map;
		try {
			map = new maplibregl.Map({
				container,
				style,
				// Comunitat Valenciana por defecto.
				center: [-0.55, 39.3],
				zoom: 7
			});
		} catch {
			// Sin WebGL (o fallo de init): la app sigue funcionando sin mapa.
			mapFailed = true;
			return;
		}
		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		mapInstance = map;

		map.on('load', () => {
			if (track) {
				map.addSource('track', { type: 'geojson', data: track });
				map.addLayer({
					id: 'track-casing',
					type: 'line',
					source: 'track',
					paint: { 'line-color': '#ffffff', 'line-width': 6 }
				});
				map.addLayer({
					id: 'track-line',
					type: 'line',
					source: 'track',
					paint: { 'line-color': '#c1121f', 'line-width': 3 }
				});
			}
		});

		if (bbox) {
			map.fitBounds(bbox, { padding: 48, animate: false });
		}
		mapReady = true;

		return () => {
			mapReady = false;
			mapInstance = null;
			map.remove();
		};
	});
</script>

<div class="map" bind:this={container}>
	{#if mapFailed}
		<p class="map-error">Mapa no disponible en este dispositivo (WebGL desactivado).</p>
	{/if}
</div>

<style>
	.map {
		width: 100%;
		height: 100%;
		min-height: 320px;
		background: var(--surface-alt);
	}
	.map-error {
		padding: 1rem;
		margin: 0;
		color: var(--muted-strong);
	}
</style>
