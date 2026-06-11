/**
 * Schema zod del JSON final de ruta (SPEC.md §3, SPECS_V2 §3). Vive en
 * src/lib porque lo usan tanto la ingesta (build) como el módulo de
 * catálogo (validación de datos descargados en runtime). Puro, sin Svelte.
 */

import { z } from 'zod';
import type { Route } from '../types';

export const MONTHS = [
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

export const ROUTE_STATUSES = [
	'homologado',
	'con_reservas',
	'en_proceso',
	'deshabilitado',
	'desconocido'
] as const;

export const mideSchema = z.strictObject({
	medio: z.number().int().min(1).max(5),
	itinerario: z.number().int().min(1).max(5),
	desplazamiento: z.number().int().min(1).max(5),
	esfuerzo: z.number().int().min(1).max(5)
});

export const routeSchema = z.strictObject({
	id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id en kebab-case'),
	name: z.string().min(1),
	type: z.enum(['GR', 'PR', 'SL']),
	status: z.enum(ROUTE_STATUSES),
	status_detail: z.string().min(1).nullable(),
	municipality: z.string().min(1).nullable(),
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
