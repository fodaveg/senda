<script lang="ts" module>
	import maplibregl from 'maplibre-gl';
	import { getStoredBinary } from '$lib/catalog/store';
	import { getLayer } from '$lib/map/layers';

	// Base cartográfica: capas WMTS del IGN España (SPEC v1 §1, SPECS_V2 §11,
	// SPECS_V3 §5). El protocolo ign://<capa>/<z>/<x>/<y> resuelve, solo para
	// la capa offline (MTN), primero el almacén local (mapa descargado por
	// ruta) y cae a la red del IGN; las demás capas son solo online. Se
	// registra una sola vez al cargar el módulo; en SSR/prerender no se piden
	// tiles.
	if (typeof window !== 'undefined') {
		maplibregl.addProtocol('ign', async (params) => {
			const match = params.url.match(/^ign:\/\/([a-z0-9]+)\/(\d+)\/(\d+)\/(\d+)$/);
			if (!match) throw new Error(`URL de tile no válida: ${params.url}`);
			const [, layerId, z, x, y] = match;
			const layer = getLayer(layerId);
			if (layer.offline) {
				const stored = await getStoredBinary(`tiles/${z}/${x}/${y}`);
				if (stored) return { data: stored };
			}
			const response = await fetch(layer.tileUrl(Number(z), Number(x), Number(y)));
			if (!response.ok) throw new Error(`IGN respondió ${response.status}`);
			return { data: await response.arrayBuffer() };
		});
	}
</script>

<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { DEFAULT_LAYER_ID, MAP_LAYERS } from '$lib/map/layers';
	import { loadMapPrefs, saveMapPrefs } from '$lib/map/prefs';
	import { trackEndpoints } from '$lib/map/track';
	import { clusterMarkers } from '$lib/map/cluster';
	import { onMount } from 'svelte';
	import type { FeatureCollection } from 'geojson';
	import type { StyleSpecification } from 'maplibre-gl';
	import type { Poi, WaterPointGeo } from '$lib/types';

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
		highlight = null,
		water = [],
		pois = [],
		showWater = true,
		showPois = true,
		waypoints = [],
		onMapClick
	}: {
		track?: FeatureCollection | null;
		markers?: MapMarker[];
		bbox?: [number, number, number, number] | null;
		onMarkerClick?: (id: string) => void;
		/** Punto resaltado [lon, lat] (hover del perfil de elevación). */
		highlight?: [number, number] | null;
		/** Fuentes de agua a pintar (SPECS_V3 §5). */
		water?: WaterPointGeo[];
		/** Puntos de interés a pintar (SPECS_V3 §5). */
		pois?: Poi[];
		showWater?: boolean;
		showPois?: boolean;
		/** Waypoints propios del usuario a pintar (SPECS_V3.5 §3). */
		waypoints?: Array<{ id: string; lat: number; lon: number; note: string }>;
		/** Clic en el mapa (lon/lat); para añadir waypoints en modo edición. */
		onMapClick?: (lngLat: { lat: number; lon: number }) => void;
	} = $props();

	// Icono (emoji) por tipo de POI para el marcador.
	const POI_ICON: Record<Poi['type'], string> = {
		mirador: '🔭',
		cumbre: '⛰️',
		patrimonio: '🏛️',
		refugio: '🏠',
		otro: '📍'
	};
	const POI_LABEL: Record<Poi['type'], string> = {
		mirador: 'Mirador',
		cumbre: 'Cumbre',
		patrimonio: 'Patrimonio',
		refugio: 'Refugio',
		otro: 'Punto de interés'
	};

	let container: HTMLDivElement;
	let mapFailed = $state(false);
	let activeLayer = $state(DEFAULT_LAYER_ID);
	let highlightMarker: maplibregl.Marker | null = null;
	let mapInstance: maplibregl.Map | null = null;
	let mapReady = $state(false);
	// Zoom actual: dispara el reclustering de marcadores al acercar/alejar.
	let mapZoom = $state(7);
	let markerHandles: maplibregl.Marker[] = [];

	/** Hace un elemento de marcador accesible por teclado (foco + Enter/Espacio). */
	function makeActivable(el: HTMLElement, label: string, action: () => void): void {
		el.tabIndex = 0;
		el.setAttribute('role', 'button');
		el.setAttribute('aria-label', label);
		el.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				action();
			}
		});
	}

	/** Muestra un popup también con el foco (teclado), no solo al pasar el ratón. */
	function popupOnHoverAndFocus(
		el: HTMLElement,
		popup: maplibregl.Popup,
		lngLat: [number, number]
	): void {
		el.tabIndex = 0;
		const show = () => popup.setLngLat(lngLat).addTo(mapInstance!);
		const hide = () => popup.remove();
		el.addEventListener('mouseenter', show);
		el.addEventListener('mouseleave', hide);
		el.addEventListener('focus', show);
		el.addEventListener('blur', hide);
	}
	let endpointHandles: maplibregl.Marker[] = [];
	let waterHandles: maplibregl.Marker[] = [];
	let poiHandles: maplibregl.Marker[] = [];
	let waypointHandles: maplibregl.Marker[] = [];

	// Marcadores reactivos con clustering (SPECS_V4 §B6): el listado filtrado
	// cambia y el mapa le sigue; los inicios próximos se agrupan según el zoom
	// (recalculado al hacer zoom). Un grupo de un solo miembro es un pin normal
	// (clic → mini-ficha); un clúster muestra el conteo (clic → acerca y separa).
	$effect(() => {
		const list = markers;
		const zoom = mapZoom;
		if (!mapReady || !mapInstance) return;
		for (const handle of markerHandles) handle.remove();
		markerHandles = clusterMarkers(list, zoom).map((cluster) => {
			if (cluster.members.length === 1) {
				const marker = cluster.members[0];
				const m = new maplibregl.Marker({ color: '#c1121f' })
					.setLngLat([marker.lon, marker.lat])
					.addTo(mapInstance!);
				const el = m.getElement();
				el.setAttribute('title', marker.name);
				el.style.cursor = 'pointer';
				const open = () => onMarkerClick?.(marker.id);
				el.addEventListener('click', (e) => {
					e.stopPropagation();
					open();
				});
				makeActivable(el, `Ruta: ${marker.name}`, open);
				return m;
			}
			const el = document.createElement('div');
			el.className = 'cluster-dot';
			el.textContent = String(cluster.members.length);
			el.setAttribute('title', `${cluster.members.length} rutas en esta zona`);
			const m = new maplibregl.Marker({ element: el })
				.setLngLat([cluster.lon, cluster.lat])
				.addTo(mapInstance!);
			const zoomIn = () =>
				mapInstance!.easeTo({ center: [cluster.lon, cluster.lat], zoom: Math.min(zoom + 2, 16) });
			el.addEventListener('click', (e) => {
				e.stopPropagation();
				zoomIn();
			});
			makeActivable(el, `${cluster.members.length} rutas agrupadas; acercar`, zoomIn);
			return m;
		});
	});

	// Pins de inicio y fin del track (SPECS_V3 §5). En circular, un único pin.
	$effect(() => {
		const fc = track;
		if (!mapReady || !mapInstance) return;
		for (const handle of endpointHandles) handle.remove();
		endpointHandles = [];
		if (!fc) return;
		const ep = trackEndpoints(fc);
		if (!ep) return;
		const start = new maplibregl.Marker({ color: '#1d7a3a' })
			.setLngLat(ep.start)
			.addTo(mapInstance);
		start.getElement().setAttribute('title', ep.circular ? 'Inicio / fin' : 'Inicio');
		endpointHandles.push(start);
		if (!ep.circular) {
			const end = new maplibregl.Marker({ color: '#c1121f' }).setLngLat(ep.end).addTo(mapInstance);
			end.getElement().setAttribute('title', 'Fin');
			endpointHandles.push(end);
		}
	});

	// Fuentes de agua (SPECS_V3 §5): marcador azul por fuente; toggle showWater.
	$effect(() => {
		const list = water;
		const show = showWater;
		if (!mapReady || !mapInstance) return;
		for (const h of waterHandles) h.remove();
		waterHandles = [];
		if (!show) return;
		for (const wp of list) {
			const el = document.createElement('div');
			el.className = 'water-dot';
			// Icono según el tipo: gota para manantial natural, grifo para fuente.
			el.textContent = wp.kind === 'manantial' ? '💧' : '🚰';
			const kind = wp.kind === 'manantial' ? 'Manantial' : 'Fuente';
			el.setAttribute('aria-label', `${kind}${wp.name ? `: ${wp.name}` : ''}`);
			const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
			popup.setHTML(
				`<strong>💧 ${wp.name ?? kind}</strong><br><span class="poi-pop-type">${kind} · km ${wp.km} · OSM, sin verificar</span>`
			);
			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([wp.lon, wp.lat])
				.addTo(mapInstance);
			popupOnHoverAndFocus(el, popup, [wp.lon, wp.lat]);
			waterHandles.push(marker);
		}
	});

	// Puntos de interés (SPECS_V3 §5): marcador con icono + popup al hover.
	$effect(() => {
		const list = pois;
		const show = showPois;
		if (!mapReady || !mapInstance) return;
		for (const h of poiHandles) h.remove();
		poiHandles = [];
		if (!show) return;
		for (const poi of list) {
			const el = document.createElement('div');
			el.className = 'poi-dot';
			el.textContent = POI_ICON[poi.type];
			el.setAttribute('aria-label', `${POI_LABEL[poi.type]}: ${poi.name}`);
			const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
			popup.setHTML(
				`<strong>${poi.name}</strong><br><span class="poi-pop-type">${POI_LABEL[poi.type]} · km ${poi.km} (OSM)</span>`
			);
			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([poi.lon, poi.lat])
				.addTo(mapInstance);
			popupOnHoverAndFocus(el, popup, [poi.lon, poi.lat]);
			poiHandles.push(marker);
		}
	});

	// Waypoints propios del usuario (SPECS_V3.5 §3): marcador morado + nota.
	$effect(() => {
		const list = waypoints;
		if (!mapReady || !mapInstance) return;
		for (const h of waypointHandles) h.remove();
		waypointHandles = [];
		for (const wp of list) {
			const el = document.createElement('div');
			el.className = 'waypoint-dot';
			el.textContent = '📍';
			el.setAttribute('aria-label', wp.note || 'Waypoint');
			if (wp.note) {
				const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
				popup.setHTML(`<strong>${wp.note}</strong>`);
				popupOnHoverAndFocus(el, popup, [wp.lon, wp.lat]);
			}
			waypointHandles.push(
				new maplibregl.Marker({ element: el }).setLngLat([wp.lon, wp.lat]).addTo(mapInstance)
			);
		}
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

	/** Estilo MapLibre con una capa base por cada capa del catálogo IGN. */
	function buildStyle(activeId: string): StyleSpecification {
		return {
			version: 8,
			sources: Object.fromEntries(
				MAP_LAYERS.map((l) => [
					`base-${l.id}`,
					{
						type: 'raster' as const,
						tiles: [`ign://${l.id}/{z}/{x}/{y}`],
						tileSize: 256,
						maxzoom: l.maxzoom,
						attribution: l.attribution
					}
				])
			),
			layers: MAP_LAYERS.map((l) => ({
				id: `base-${l.id}`,
				type: 'raster' as const,
				source: `base-${l.id}`,
				layout: { visibility: l.id === activeId ? ('visible' as const) : ('none' as const) }
			}))
		};
	}

	/** Cambia la capa base visible y persiste la elección. */
	function setBaseLayer(id: string): void {
		activeLayer = getLayer(id).id;
		if (mapInstance) {
			for (const l of MAP_LAYERS) {
				mapInstance.setLayoutProperty(
					`base-${l.id}`,
					'visibility',
					l.id === activeLayer ? 'visible' : 'none'
				);
			}
		}
		saveMapPrefs({ ...loadMapPrefs(), layer: activeLayer });
	}

	onMount(() => {
		activeLayer = getLayer(loadMapPrefs().layer).id;

		let map: maplibregl.Map;
		try {
			map = new maplibregl.Map({
				container,
				style: buildStyle(activeLayer),
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
		map.on('click', (e) => onMapClick?.({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
		// El reclustering sigue el zoom (zoomend evita recalcular en cada frame).
		map.on('zoomend', () => (mapZoom = map.getZoom()));
		mapInstance = map;

		map.on('load', () => {
			if (track) {
				map.addSource('track', { type: 'geojson', data: track });
				// Casing (halo blanco) + línea: anchos interpolados por zoom para
				// que el track se distinga también a poca escala (SPECS_V3 §5).
				map.addLayer({
					id: 'track-casing',
					type: 'line',
					source: 'track',
					layout: { 'line-cap': 'round', 'line-join': 'round' },
					paint: {
						'line-color': '#ffffff',
						'line-width': ['interpolate', ['linear'], ['zoom'], 7, 4, 12, 8, 16, 12]
					}
				});
				map.addLayer({
					id: 'track-line',
					type: 'line',
					source: 'track',
					layout: { 'line-cap': 'round', 'line-join': 'round' },
					paint: {
						'line-color': '#e0001b',
						'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 12, 4.5, 16, 7]
					}
				});
			}
		});

		if (bbox) {
			map.fitBounds(bbox, { padding: 48, animate: false });
		}
		mapZoom = map.getZoom();
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
	{:else if MAP_LAYERS.length > 1}
		<div class="layer-switcher">
			<label class="sr-only" for="map-layer-select">Capa del mapa</label>
			<select
				id="map-layer-select"
				value={activeLayer}
				onchange={(e) => setBaseLayer((e.currentTarget as HTMLSelectElement).value)}
			>
				{#each MAP_LAYERS as layer (layer.id)}
					<option value={layer.id}>{layer.name}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>

<style>
	.map {
		position: relative;
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
	.layer-switcher {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 1;
	}
	.layer-switcher select {
		padding: 0.3rem 0.5rem;
		border-radius: 0.4rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--ink);
		font-size: 0.85rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
		cursor: pointer;
	}
	.map :global(.water-dot) {
		font-size: 17px;
		line-height: 1;
		cursor: help;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
	}
	.map :global(.poi-dot) {
		font-size: 17px;
		line-height: 1;
		cursor: help;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
	}
	/* Foco visible por teclado en cualquier marcador accesible. */
	.map :global(.maplibregl-marker:focus-visible) {
		outline: 3px solid #1d6fe0;
		outline-offset: 2px;
		border-radius: 4px;
	}
	.map :global(.cluster-dot) {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 30px;
		height: 30px;
		padding: 0 6px;
		border-radius: 999px;
		background: #1d3a2a;
		color: #fff;
		font-size: 0.85rem;
		font-weight: 700;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		cursor: pointer;
	}
	.map :global(.waypoint-dot) {
		font-size: 18px;
		line-height: 1;
		cursor: help;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6)) hue-rotate(260deg) saturate(1.5);
	}
	.map :global(.poi-pop-type) {
		color: var(--muted);
		font-size: 0.8rem;
	}
	/* El popup de MapLibre trae fondo blanco fijo: lo atamos al tema para que en
	   modo oscuro no quede texto claro sobre blanco. */
	.map :global(.maplibregl-popup-content) {
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--border);
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
	}
	/* La "flecha" del bocadillo es un triángulo cuyo lado coloreado depende del
	   anclaje; igualamos ese lado al fondo del popup. */
	.map :global([class*='maplibregl-popup-anchor-top'] .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}
	.map :global([class*='maplibregl-popup-anchor-bottom'] .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}
	.map :global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
		border-right-color: var(--surface);
	}
	.map :global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
		border-left-color: var(--surface);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
