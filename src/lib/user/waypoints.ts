/**
 * Waypoints propios del usuario por ruta (SPECS_V3.5 §3): puntos que marca en
 * el mapa ("coche aquí", "fuente vista", "desvío"). localStorage con esquema
 * versionado, anonimizable/exportable (preparado para la sync de v4). El id y
 * la creación se generan con `makeWaypoint` (pura).
 */

import { z } from 'zod';

export const WAYPOINTS_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'senderos-cv:waypoints';

const waypointSchema = z.object({
	id: z.string().min(1),
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180),
	note: z.string(),
	created_at: z.string()
});

const dataSchema = z.object({
	schema: z.literal(WAYPOINTS_SCHEMA_VERSION),
	byRoute: z.record(z.string(), z.array(waypointSchema))
});

export type Waypoint = z.infer<typeof waypointSchema>;
type WaypointsData = z.infer<typeof dataSchema>;

function emptyData(): WaypointsData {
	return { schema: WAYPOINTS_SCHEMA_VERSION, byRoute: {} };
}

function loadData(): WaypointsData {
	if (typeof localStorage === 'undefined') return emptyData();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return emptyData();
		const parsed = dataSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : emptyData();
	} catch {
		return emptyData();
	}
}

/** Crea un waypoint con id y fecha (puro salvo el id aleatorio/fecha). */
export function makeWaypoint(lat: number, lon: number, note: string): Waypoint {
	const id =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return { id, lat, lon, note, created_at: new Date().toISOString() };
}

export function loadWaypoints(routeId: string): Waypoint[] {
	return loadData().byRoute[routeId] ?? [];
}

export function saveWaypoints(routeId: string, list: Waypoint[]): void {
	if (typeof localStorage === 'undefined') return;
	const data = loadData();
	if (list.length > 0) data.byRoute[routeId] = list;
	else delete data.byRoute[routeId];
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// preferencia local; si falla, no pasa nada
	}
}

/** Valida un volcado importado (export/import o sync v4). */
export function parseWaypointsImport(raw: unknown): WaypointsData {
	return dataSchema.parse(raw);
}
