/**
 * Construcción del JSON final de ruta: merge de lo derivado del GPX con la
 * capa crawleada del portal FEMECV y los metadatos manuales, y validación
 * contra el schema. Prioridad: manual (verificado por humano) > crawleado
 * (ficha oficial) > derivado del GPX. Puro para ser testeable; la E/S de
 * ficheros vive en cli.ts.
 */

import { z } from 'zod';
import type { Route } from '../../src/lib/types';
import type { GpxSummary } from './gpx';
import {
	crawledSchema,
	enrichedSchema,
	manualSchema,
	routeSchema,
	type CrawledData,
	type EnrichedData,
	type ManualData
} from './schema';

export class IngestError extends Error {
	constructor(
		public readonly routeId: string,
		message: string
	) {
		super(`[${routeId}] ${message}`);
		this.name = 'IngestError';
	}
}

export function parseManual(id: string, raw: unknown): ManualData {
	const result = manualSchema.safeParse(raw);
	if (!result.success) {
		throw new IngestError(
			id,
			`metadatos manuales inválidos en _manual/${id}.json:\n${z.prettifyError(result.error)}`
		);
	}
	return result.data;
}

export function parseEnriched(id: string, raw: unknown): EnrichedData {
	const result = enrichedSchema.safeParse(raw);
	if (!result.success) {
		throw new IngestError(
			id,
			`datos enriquecidos inválidos en _enriched/${id}.json:\n${z.prettifyError(result.error)}`
		);
	}
	return result.data;
}

export function parseCrawled(id: string, raw: unknown): CrawledData {
	const result = crawledSchema.safeParse(raw);
	if (!result.success) {
		throw new IngestError(
			id,
			`datos crawleados inválidos en _crawled/${id}.json:\n${z.prettifyError(result.error)}`
		);
	}
	return result.data;
}

/**
 * Clave de zona (data/wildlife/zones.json) derivada de la comarca de la
 * ficha: minúsculas, sin acentos y sin artículo inicial.
 * "Los Serranos" → "serranos", "La Marina Alta" → "marina-alta".
 */
export function zoneFromComarca(comarca: string | null): string | null {
	if (!comarca) return null;
	const normalized = comarca
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/^(els?|las?|los|l')\s*/i, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return normalized || null;
}

/**
 * Merge: derivado del GPX como base; lo crawleado (ficha oficial) por
 * encima; lo manual (verificado), cuando existe, tiene la última palabra.
 * Campos ausentes en todas las capas → null/[] (nunca inventados).
 */
export function buildRoute(
	id: string,
	summary: GpxSummary,
	manual: ManualData | null,
	crawled: CrawledData | null = null,
	enriched: EnrichedData | null = null
): Route {
	if (!manual && !crawled) {
		throw new IngestError(id, 'sin metadatos: hace falta _manual/<id>.json o _crawled/<id>.json');
	}
	const m: Partial<ManualData> = manual ?? {};
	const c: Partial<CrawledData> = crawled ?? {};

	const name = m.name ?? c.name;
	const type = m.type ?? c.type;
	if (!name || !type) {
		throw new IngestError(id, 'faltan name/type en los metadatos');
	}

	// Solo se citan como derivados del GPX los campos que no vinieron de
	// ninguna capa de metadatos.
	const derived: string[] = [];
	if (m.distance_km === undefined && c.distance_km == null) derived.push('distancia');
	if (m.ascent_m === undefined && c.ascent_m == null) derived.push('desniveles');
	if (m.start?.lat === undefined) derived.push('inicio');
	if (m.circular === undefined && c.circular == null) derived.push('circularidad');
	derived.push('bbox');

	const sources: string[] = [...(m.sources ?? [])];
	if (crawled) {
		sources.push(
			`Ficha FEMECV ${crawled.femecv_url} (crawl ${crawled.crawled_at.slice(0, 10)}): ` +
				`nombre, estado "${crawled.status_detail ?? 'sin estado publicado'}"` +
				`${crawled.distance_km != null ? ', distancia' : ''}` +
				`${crawled.ascent_m != null || crawled.descent_m != null ? ', desniveles' : ''}` +
				`${crawled.est_duration_min != null ? ', horario teórico' : ''}` +
				`${crawled.difficulty_mide ? ', MIDE' : ''}` +
				`${crawled.circular != null ? ', modalidad' : ''}` +
				`${crawled.municipality ? ', municipio' : ''}` +
				`${crawled.comarca ? ', comarca' : ''}`
		);
	}
	if (enriched) {
		sources.push(
			`OSM Overpass (enrich ${enriched.enriched_at.slice(0, 10)}): fuentes de agua, sombra estimada ` +
				'y alternativas por proximidad — no verificado en campo'
		);
	}
	sources.push(`GPX ${id}.gpx (derivados: ${derived.join(', ')})`);

	const route: Route = {
		id,
		name,
		type,
		status: m.status ?? c.status ?? 'desconocido',
		status_detail: m.status_detail ?? c.status_detail ?? null,
		municipality: m.municipality ?? c.municipality ?? null,
		zone: m.zone !== undefined ? m.zone : zoneFromComarca(c.comarca ?? null),
		aemet_municipio: m.aemet_municipio ?? null,
		start: {
			lat: m.start?.lat ?? summary.start.lat,
			lon: m.start?.lon ?? summary.start.lon,
			name: m.start?.name ?? c.start_name ?? null
		},
		distance_km: m.distance_km ?? c.distance_km ?? summary.distance_km,
		ascent_m: m.ascent_m ?? c.ascent_m ?? summary.ascent_m,
		descent_m: m.descent_m ?? c.descent_m ?? summary.descent_m,
		circular: m.circular ?? c.circular ?? summary.circular,
		difficulty_mide: m.difficulty_mide ?? c.difficulty_mide ?? null,
		est_duration_min: m.est_duration_min ?? c.est_duration_min ?? null,
		water_points: m.water_points ?? enriched?.water_points ?? [],
		water_points_geo: enriched?.water_points_geo ?? [],
		pois: enriched?.pois ?? [],
		escape_routes: m.escape_routes ?? [],
		highlights: m.highlights ?? [],
		best_season: m.best_season ?? [],
		best_start_time: m.best_start_time ?? null,
		shade_ratio: m.shade_ratio ?? enriched?.shade_ratio ?? null,
		gpx: `${id}.gpx`,
		links: {
			femecv: m.links?.femecv ?? c.femecv_url ?? null,
			wikiloc: m.links?.wikiloc ?? null
		},
		alternatives: m.alternatives ?? enriched?.alternatives ?? [],
		notes_rain: m.notes_rain ?? null,
		bbox: summary.bbox,
		sources
	};

	const result = routeSchema.safeParse(route);
	if (!result.success) {
		throw new IngestError(id, `la ruta resultante no valida:\n${z.prettifyError(result.error)}`);
	}
	return result.data;
}
