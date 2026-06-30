/**
 * Ingesta de Navarra (FNDME) — núcleo puro (multi-federación V5-1).
 *
 * Modelo acordado (ver SPECS_V5_CCAA_ENDPOINTS §Navarra):
 *   - **Existencia / estado / nombre / etapas** → MiSendaFEDME (`ccaa=nc`), la
 *     fuente oficial de la federación (uso como allowlist, no como dato técnico).
 *   - **Geometría oficial (CC-BY)** → IDENA WFS, **una capa por sendero**
 *     (`DOTACI_Lin_<matrícula>`), en EPSG:25830 → reproyectada a WGS84.
 *
 * Como IDENA publica el sendero **entero** (no por etapa) pero MiSenda lista
 * **etapas**, se ingiere **una ruta por sendero** y las etapas se conservan como
 * **metadato** (`etapas_meta`). Honestidad: la geometría 2D de IDENA no trae
 * altitud → `ascent_m` queda `null` (no se inventa).
 *
 * Todo aquí es puro y testeable; la red y la escritura viven en `navarra-cli.ts`.
 */

import proj4 from 'proj4';
import type { FeatureCollection } from 'geojson';
import type { Route, RouteStage, RouteType } from '../../../src/lib/types';
import { FEDERATIONS } from '../../../src/lib/data/federation';
import { haversineMeters } from '../../../src/lib/geo/distance';

/** EPSG:25830 (ETRS89 / UTM 30N), el CRS de la geometría de IDENA. */
proj4.defs(
	'EPSG:25830',
	'+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

export const FNDME = FEDERATIONS.FNDME;

/** Una etapa tal como la devuelve el catálogo de MiSendaFEDME (`ccaa=nc`). */
export interface MapaEtapa {
	matricula: string;
	codi_matricula: string;
	titulo: string;
	gr_parent_titulo: string;
	gr_parent_permalink?: string;
	permalink: string;
	id: string;
}

/** Sendero agrupado a partir de sus etapas, listo para casar con IDENA. */
export interface Sendero {
	/** Matrícula del sendero ("GR 11", "PR-NA 121"). */
	matricula: string;
	/** Nombre legible del sendero (de `gr_parent_titulo`). */
	name: string;
	type: RouteType;
	/** Capa de IDENA con la geometría del sendero. */
	idenaLayer: string;
	/** Id namespaced del catálogo ("na-gr-11"). */
	id: string;
	/** Permalink oficial del sendero en MiSenda (si lo trae el catálogo). */
	permalink: string | null;
	/** Etapas como metadato, ordenadas. */
	etapas: RouteStage[];
}

/** Matrícula del sendero a partir de la de una etapa ("GR 11. Etapa 8a" → "GR 11"). */
export function senderoMatricula(etapaMatricula: string): string {
	return etapaMatricula.replace(/\.\s*Etapa.*$/i, '').trim();
}

/**
 * Nombre de la capa IDENA para una matrícula ("PR-NA 121" → "DOTACI_Lin_PRNA121").
 * Quita separadores y normaliza a mayúsculas; además recorta los ceros a la
 * izquierda del número final ("GR T 03" → "GRT3", que es como IDENA nombra la capa).
 */
export function idenaLayer(matricula: string): string {
	const code = matricula
		.replace(/[^A-Za-z0-9]/g, '')
		.toUpperCase()
		.replace(/0*(\d+)$/, '$1');
	return `DOTACI_Lin_${code}`;
}

/** Id namespaced kebab-case ("GR 11" → "na-gr-11"). */
export function senderoId(matricula: string): string {
	const slug = matricula
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	return `na-${slug || 'sendero'}`;
}

/** Número de etapa de una matrícula ("GR 11. Etapa 8a" → 8); 1 si no hay etapa. */
export function etapaOrder(etapaMatricula: string): number {
	const m = /Etapa\s*0*(\d+)/i.exec(etapaMatricula);
	return m ? Number(m[1]) : 1;
}

/** Agrupa las etapas del catálogo en senderos (por `gr_parent_titulo`). */
export function groupSenderos(etapas: MapaEtapa[]): Sendero[] {
	const byParent = new Map<string, MapaEtapa[]>();
	for (const e of etapas) {
		const key = e.gr_parent_titulo || e.matricula;
		const list = byParent.get(key) ?? [];
		list.push(e);
		byParent.set(key, list);
	}
	const senderos: Sendero[] = [];
	for (const [parent, list] of byParent) {
		const first = list[0];
		const matricula = senderoMatricula(first.matricula);
		// Nombre: el del padre sin la coletilla " . Navarra" ni sufijos de CCAA.
		const name = (parent || first.titulo).replace(/\.\s*Navarra\s*$/i, '').trim();
		const etapasMeta: RouteStage[] = list
			.map((e) => ({ order: etapaOrder(e.matricula), name: e.titulo }))
			.sort((a, b) => a.order - b.order);
		senderos.push({
			matricula,
			name,
			type: first.codi_matricula as RouteType,
			idenaLayer: idenaLayer(matricula),
			id: senderoId(matricula),
			permalink: first.gr_parent_permalink ?? null,
			etapas: etapasMeta
		});
	}
	return senderos.sort((a, b) => a.id.localeCompare(b.id));
}

/** Reproyecta un punto EPSG:25830 → WGS84 [lon, lat]. */
export function reproject25830([e, n]: [number, number]): [number, number] {
	const [lon, lat] = proj4('EPSG:25830', 'EPSG:4326', [e, n]);
	return [lon, lat];
}

/**
 * Reproyecta el FeatureCollection de IDENA (líneas EPSG:25830) a **segmentos**
 * WGS84 separados. Clave: IDENA publica el sendero como múltiples tramos en orden
 * arbitrario; concatenarlos crearía saltos enormes (zigzag, distancia inflada).
 * Por eso se conservan como segmentos independientes (se renderizan como
 * MultiLineString, sin líneas falsas que los unan). Puro.
 */
export function geojsonToSegments(fc: FeatureCollection): [number, number][][] {
	const segments: [number, number][][] = [];
	for (const f of fc.features) {
		const g = f.geometry;
		if (!g) continue;
		const lines: number[][][] =
			g.type === 'LineString'
				? [g.coordinates as number[][]]
				: g.type === 'MultiLineString'
					? (g.coordinates as number[][][])
					: [];
		for (const line of lines) {
			const seg = line.map(([e, n]) => reproject25830([e, n]));
			if (seg.length >= 2) segments.push(seg);
		}
	}
	return segments;
}

export interface TrackSummary {
	start: { lat: number; lon: number };
	end: { lat: number; lon: number };
	bbox: [number, number, number, number];
	/** Suma de la longitud de cada tramo (no salta entre tramos). */
	distance_km: number;
}

/** Resumen geométrico de un sendero por segmentos (bbox + distancia real + extremos). */
export function trackSummary(segments: [number, number][][]): TrackSummary | null {
	const flat = segments.flat();
	if (flat.length < 2) return null;
	let minLon = Infinity,
		minLat = Infinity,
		maxLon = -Infinity,
		maxLat = -Infinity,
		meters = 0;
	for (const [lon, lat] of flat) {
		minLon = Math.min(minLon, lon);
		minLat = Math.min(minLat, lat);
		maxLon = Math.max(maxLon, lon);
		maxLat = Math.max(maxLat, lat);
	}
	// Distancia: longitud de cada tramo por separado (sin unir tramos).
	for (const seg of segments) {
		for (let i = 1; i < seg.length; i++) meters += haversineMeters(seg[i - 1], seg[i]);
	}
	const first = segments[0][0];
	const lastSeg = segments[segments.length - 1];
	const last = lastSeg[lastSeg.length - 1];
	return {
		start: { lat: first[1], lon: first[0] },
		end: { lat: last[1], lon: last[0] },
		bbox: [minLon, minLat, maxLon, maxLat],
		distance_km: Math.round((meters / 1000) * 10) / 10
	};
}

/** Serializa los segmentos a GPX, **un `<trkseg>` por tramo** (sin unirlos). */
export function segmentsToGpx(segments: [number, number][][], name: string): string {
	const safeName = name.replace(/[<>&]/g, '');
	const segs = segments
		.map((seg) => {
			const pts = seg
				.map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`)
				.join('\n');
			return `    <trkseg>\n${pts}\n    </trkseg>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="senda-navarra" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${safeName}</name>
${segs}
  </trk>
</gpx>
`;
}

/** Construye la `Route` de un sendero de Navarra a partir de su geometría IDENA. */
export function buildRoute(sendero: Sendero, summary: TrackSummary, consultaDate: string): Route {
	return {
		id: sendero.id,
		name: sendero.name,
		type: sendero.type,
		// Presencia en la fuente oficial de la federación ≈ homologado / en vigor.
		status: 'homologado',
		status_detail: null,
		municipality: null,
		zone: null,
		aemet_municipio: null,
		start: { lat: summary.start.lat, lon: summary.start.lon, name: null },
		end: summary.end,
		distance_km: summary.distance_km,
		ascent_m: null, // IDENA 2D: sin altitud → no se inventa
		descent_m: null,
		// La geometría de IDENA viene en tramos sin ordenar: no se puede determinar
		// el recorrido de forma fiable → null (desconocido), no se afirma.
		circular: null,
		difficulty_mide: null,
		est_duration_min: null,
		water_points: [],
		water_points_geo: [],
		pois: [],
		escape_routes: [],
		highlights: [],
		best_season: [],
		best_start_time: null,
		shade_ratio: null,
		gpx: `${sendero.id}.gpx`,
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: summary.bbox,
		sources: [
			`Existencia, estado, nombre y etapas: MiSendaFEDME (FNDME, ccaa=nc)${sendero.permalink ? ` ${sendero.permalink}` : ''} (consulta ${consultaDate})`,
			`Geometría oficial: IDENA WFS capa ${sendero.idenaLayer} (Gobierno de Navarra, CC-BY 4.0; reproyectada EPSG:25830→WGS84)`,
			`Estado: presencia en la fuente oficial de la federación ≈ en vigor`
		],
		federacion: FNDME.id,
		comunidad: FNDME.comunidad,
		capabilities: FNDME.capabilities,
		etapas_meta: sendero.etapas.length > 1 ? sendero.etapas : undefined
	};
}
