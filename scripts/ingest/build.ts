/**
 * Construcción del JSON final de ruta: merge de lo derivado del GPX con los
 * metadatos manuales y validación contra el schema. Puro para ser testeable;
 * la E/S de ficheros vive en cli.ts.
 */

import { z } from 'zod';
import type { Route } from '../../src/lib/types';
import type { GpxSummary } from './gpx';
import { manualSchema, routeSchema, type ManualData } from './schema';

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

/**
 * Merge: derivado del GPX como base; lo manual, cuando existe, tiene
 * prioridad (dato oficial FEMECV > dato calculado del track). Campos no
 * derivables y ausentes en lo manual → null/[] (nunca inventados).
 */
export function buildRoute(id: string, summary: GpxSummary, manual: ManualData): Route {
	// Solo se citan como derivados del GPX los campos que no vinieron del manual.
	const derived: string[] = [];
	if (manual.distance_km === undefined) derived.push('distancia');
	if (manual.ascent_m === undefined && manual.descent_m === undefined) derived.push('desniveles');
	if (manual.start?.lat === undefined && manual.start?.lon === undefined) derived.push('inicio');
	if (manual.circular === undefined) derived.push('circularidad');
	derived.push('bbox');

	const route: Route = {
		id,
		name: manual.name,
		type: manual.type,
		status: manual.status ?? 'homologado',
		zone: manual.zone ?? null,
		start: {
			lat: manual.start?.lat ?? summary.start.lat,
			lon: manual.start?.lon ?? summary.start.lon,
			name: manual.start?.name ?? null
		},
		distance_km: manual.distance_km ?? summary.distance_km,
		ascent_m: manual.ascent_m ?? summary.ascent_m,
		descent_m: manual.descent_m ?? summary.descent_m,
		circular: manual.circular ?? summary.circular,
		difficulty_mide: manual.difficulty_mide ?? null,
		est_duration_min: manual.est_duration_min ?? null,
		water_points: manual.water_points ?? [],
		escape_routes: manual.escape_routes ?? [],
		highlights: manual.highlights ?? [],
		best_season: manual.best_season ?? [],
		best_start_time: manual.best_start_time ?? null,
		shade_ratio: manual.shade_ratio ?? null,
		gpx: `${id}.gpx`,
		links: {
			femecv: manual.links?.femecv ?? null,
			wikiloc: manual.links?.wikiloc ?? null
		},
		alternatives: manual.alternatives ?? [],
		notes_rain: manual.notes_rain ?? null,
		bbox: summary.bbox,
		sources: [...manual.sources, `GPX ${id}.gpx (derivados: ${derived.join(', ')})`]
	};

	const result = routeSchema.safeParse(route);
	if (!result.success) {
		throw new IngestError(id, `la ruta resultante no valida:\n${z.prettifyError(result.error)}`);
	}
	return result.data;
}
