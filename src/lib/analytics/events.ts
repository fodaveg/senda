/**
 * Constructores **puros** de eventos de analítica anónima y su validación
 * (SPECS_V4 §B3/§11). El payload debe cumplir la misma forma que exige el
 * `check` de la BD: objeto, con `route_id` o `name`, y **sin** `user_id`/`email`
 * (barrera anti-PII en cliente, además de la del servidor). Validar antes de
 * enviar evita almacenar nada reidentificable aunque cambie el código de la UI.
 */

import { z } from 'zod';
import type { AnalyticsEvent, AnalyticsKind } from './types';

/** Evento de ruta (favorita/completada): payload `{ route_id }`. */
export function routeEvent(kind: 'favorita' | 'completada', routeId: string): AnalyticsEvent {
	return { kind, payload: { route_id: routeId } };
}

/** Evento de material llevado: payload `{ name }` (nombre normalizado). */
export function gearEvent(name: string): AnalyticsEvent {
	return { kind: 'material', payload: { name: normalizeGearName(name) } };
}

/** Normaliza el nombre del material para agregaciones estables (sin PII). */
export function normalizeGearName(name: string): string {
	return name.trim().toLowerCase();
}

const KINDS: AnalyticsKind[] = ['favorita', 'completada', 'material'];

const payloadSchema = z
	.object({
		route_id: z.string().min(1).optional(),
		name: z.string().min(1).optional()
	})
	// Debe traer al menos una clave de objeto (espejo del check del servidor).
	.refine((p) => p.route_id !== undefined || p.name !== undefined, 'falta route_id o name');

/**
 * ¿Es un evento válido y anónimo? Comprueba el tipo, la forma del payload (igual
 * que el `check` del servidor) y, explícitamente, que no haya PII (la comprobación
 * de claves se hace antes del parse de zod, que descartaría las claves extra).
 */
export function isValidEvent(event: AnalyticsEvent): boolean {
	if (!KINDS.includes(event.kind)) return false;
	if (!event.payload || typeof event.payload !== 'object') return false;
	if ('user_id' in event.payload || 'email' in event.payload) return false;
	return payloadSchema.safeParse(event.payload).success;
}
