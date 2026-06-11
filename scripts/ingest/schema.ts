/**
 * Schemas zod de la ingesta (SPEC.md §3, SPECS_V2 §3-§4): validación
 * estricta de los metadatos manuales y de la capa crawleada del portal
 * FEMECV. El schema del JSON final vive en src/lib/data/schema.ts (lo
 * comparte el módulo de catálogo en runtime).
 */

import { z } from 'zod';
import { mideSchema, MONTHS, ROUTE_STATUSES, routeSchema } from '../../src/lib/data/schema';

export { routeSchema };

/**
 * Metadatos manuales de data/routes/_manual/<id>.json: lo no derivable del GPX.
 * Obligatorios: name, type y sources (verificación antes que completitud —
 * todo dato manual debe citar su origen). El resto es opcional y, si se da,
 * tiene prioridad sobre lo crawleado y lo derivado del GPX.
 */
export const manualSchema = z.strictObject({
	name: z.string().min(1),
	type: z.enum(['GR', 'PR', 'SL']),
	sources: z.array(z.string().min(1)).min(1),
	status: z.enum(ROUTE_STATUSES).optional(),
	status_detail: z.string().min(1).optional(),
	municipality: z.string().min(1).optional(),
	zone: z.string().min(1).nullable().optional(),
	aemet_municipio: z
		.string()
		.regex(/^\d{5}$/, 'código INE de 5 dígitos')
		.optional(),
	start: z
		.strictObject({
			lat: z.number().min(-90).max(90).optional(),
			lon: z.number().min(-180).max(180).optional(),
			name: z.string().min(1).nullable().optional()
		})
		.optional(),
	distance_km: z.number().positive().optional(),
	ascent_m: z.number().min(0).optional(),
	descent_m: z.number().min(0).optional(),
	circular: z.boolean().optional(),
	difficulty_mide: mideSchema.optional(),
	est_duration_min: z.number().positive().optional(),
	water_points: z.array(z.string().min(1)).optional(),
	escape_routes: z.array(z.string().min(1)).optional(),
	highlights: z.array(z.string().min(1)).optional(),
	best_season: z.array(z.enum(MONTHS)).optional(),
	best_start_time: z.string().min(1).optional(),
	shade_ratio: z.number().min(0).max(1).optional(),
	links: z
		.strictObject({
			femecv: z.url().nullable().optional(),
			wikiloc: z.url().nullable().optional()
		})
		.optional(),
	alternatives: z.array(z.string()).optional(),
	notes_rain: z.string().min(1).optional()
});

export type ManualData = z.infer<typeof manualSchema>;

/**
 * Capa crawleada de data/routes/_crawled/<id>.json: lo que publica la ficha
 * del portal FEMECV (SPECS_V2 §4). La escribe `npm run ingest:crawl`; no se
 * edita a mano. Prioridad: manual > crawleado > derivado del GPX.
 */
export const crawledSchema = z.strictObject({
	name: z.string().min(1),
	type: z.enum(['GR', 'PR', 'SL']),
	status: z.enum(ROUTE_STATUSES),
	/** Literal exacto del portal ("Control de calidad positivo", …). */
	status_detail: z.string().min(1).nullable(),
	municipality: z.string().min(1).nullable(),
	/** Comarca según la ficha; de aquí se deriva `zone`. */
	comarca: z.string().min(1).nullable(),
	distance_km: z.number().positive().nullable(),
	ascent_m: z.number().min(0).nullable(),
	descent_m: z.number().min(0).nullable(),
	circular: z.boolean().nullable(),
	difficulty_mide: mideSchema.nullable(),
	est_duration_min: z.number().positive().nullable(),
	start_name: z.string().min(1).nullable(),
	femecv_url: z.url(),
	gpx_url: z.url().nullable(),
	/** Fecha ISO de la consulta al portal. */
	crawled_at: z.string().min(1)
});

export type CrawledData = z.infer<typeof crawledSchema>;
