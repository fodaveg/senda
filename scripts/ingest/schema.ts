/**
 * Schemas zod de la ingesta (SPEC.md §3): validación estricta del JSON
 * final de ruta y del fichero de metadatos manuales.
 */

import { z } from 'zod';
import type { Route } from '../../src/lib/types';

const MONTHS = [
	'ene',
	'feb',
	'mar',
	'abr',
	'may',
	'jun',
	'jul',
	'ago',
	'sep',
	'oct',
	'nov',
	'dic'
] as const;

const mideSchema = z.strictObject({
	medio: z.number().int().min(1).max(5),
	itinerario: z.number().int().min(1).max(5),
	desplazamiento: z.number().int().min(1).max(5),
	esfuerzo: z.number().int().min(1).max(5)
});

export const routeSchema = z.strictObject({
	id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id en kebab-case'),
	name: z.string().min(1),
	type: z.enum(['GR', 'PR', 'SL']),
	status: z.string().min(1),
	zone: z.string().min(1).nullable(),
	aemet_municipio: z
		.string()
		.regex(/^\d{5}$/, 'código INE de 5 dígitos')
		.nullable(),
	start: z.strictObject({
		lat: z.number().min(-90).max(90),
		lon: z.number().min(-180).max(180),
		name: z.string().min(1).nullable()
	}),
	distance_km: z.number().positive(),
	ascent_m: z.number().min(0).nullable(),
	descent_m: z.number().min(0).nullable(),
	circular: z.boolean().nullable(),
	difficulty_mide: mideSchema.nullable(),
	est_duration_min: z.number().positive().nullable(),
	water_points: z.array(z.string().min(1)),
	escape_routes: z.array(z.string().min(1)),
	highlights: z.array(z.string().min(1)),
	best_season: z.array(z.enum(MONTHS)),
	best_start_time: z.string().min(1).nullable(),
	shade_ratio: z.number().min(0).max(1).nullable(),
	gpx: z.string().regex(/\.gpx$/),
	links: z.strictObject({
		femecv: z.url().nullable(),
		wikiloc: z.url().nullable()
	}),
	alternatives: z.array(z.string()),
	notes_rain: z.string().min(1).nullable(),
	bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
	sources: z.array(z.string().min(1)).min(1)
}) satisfies z.ZodType<Route>;

/**
 * Metadatos manuales de data/routes/_manual/<id>.json: lo no derivable del GPX.
 * Obligatorios: name, type y sources (verificación antes que completitud —
 * todo dato manual debe citar su origen). El resto es opcional y, si se da,
 * tiene prioridad sobre lo derivado del GPX (dato oficial > dato calculado).
 */
export const manualSchema = z.strictObject({
	name: z.string().min(1),
	type: z.enum(['GR', 'PR', 'SL']),
	sources: z.array(z.string().min(1)).min(1),
	status: z.string().min(1).optional(),
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
