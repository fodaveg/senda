<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
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

	// Tiles raster OpenTopoMap (SPEC §1). Sin API key.
	const style: StyleSpecification = {
		version: 8,
		sources: {
			opentopo: {
				type: 'raster',
				tiles: [
					'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
					'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
					'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
				],
				tileSize: 256,
				attribution:
					'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
			}
		},
		layers: [{ id: 'opentopo', type: 'raster', source: 'opentopo' }]
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

		for (const marker of markers) {
			const m = new maplibregl.Marker({ color: '#c1121f' })
				.setLngLat([marker.lon, marker.lat])
				.addTo(map);
			m.getElement().setAttribute('title', marker.name);
			m.getElement().style.cursor = 'pointer';
			m.getElement().addEventListener('click', () => onMarkerClick?.(marker.id));
		}

		if (bbox) {
			map.fitBounds(bbox, { padding: 48, animate: false });
		}

		return () => {
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
