/**
 * Etiquetas y semántica visual del estado de homologación (SPECS_V2 §3/§6).
 * Puro: lo comparten listado, ficha e informe.
 */

import type { RouteStatus } from '$lib/types';

export const STATUS_LABELS: Record<RouteStatus, string> = {
	homologado: 'Homologada',
	con_reservas: 'Con reservas',
	en_proceso: 'En proceso',
	deshabilitado: 'Deshabilitada',
	desconocido: 'Estado desconocido'
};

/** Clase CSS del badge (verde / ámbar / gris / rojo). */
export const STATUS_TONE: Record<RouteStatus, 'ok' | 'warn' | 'neutral' | 'danger'> = {
	homologado: 'ok',
	con_reservas: 'warn',
	en_proceso: 'neutral',
	desconocido: 'neutral',
	deshabilitado: 'danger'
};

/** Estados ofrecidos en el filtro del listado, en orden de presentación. */
export const STATUS_FILTER_OPTIONS: RouteStatus[] = [
	'homologado',
	'con_reservas',
	'en_proceso',
	'desconocido',
	'deshabilitado'
];
