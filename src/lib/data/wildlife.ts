/** Fichas de fauna/riesgos por zona, estáticas en build (SPEC §7). */

import type { WildlifeZone } from '$lib/types';
import zonesJson from '../../../data/wildlife/zones.json';

export const wildlifeZones = zonesJson as Record<string, WildlifeZone>;

export function wildlifeForZone(zone: string | null): WildlifeZone | null {
	if (!zone) return null;
	return wildlifeZones[zone] ?? null;
}

/**
 * Mapa palabra-clave → emoji para decorar el nombre de una especie en la ficha
 * (handoff v6). Es **solo decoración** del dato real (el nombre); no añade
 * información ni fuente. Primer patrón que casa gana; respaldo genérico de
 * huella para especies sin icono específico.
 */
const WILDLIFE_EMOJI: readonly [RegExp, string][] = [
	[/cabra|mufl[oó]n|rebeco|sarrio/i, '🐐'],
	[/jabal[ií]|cerdo/i, '🐗'],
	[/v[ií]bora|culebra|serpiente|ofidio/i, '🐍'],
	[/[aá]guila|buitre|halc[oó]n|rapaz|\bave\b/i, '🦅'],
	[/zorro/i, '🦊'],
	[/ciervo|corzo|gamo|venado/i, '🦌'],
	[/perro|mast[ií]n|ganado/i, '🐕'],
	[/abeja|avispa|insecto/i, '🐝']
];

/** Emoji decorativo para una especie; 🐾 si no hay coincidencia. */
export function wildlifeEmoji(species: string): string {
	return WILDLIFE_EMOJI.find(([re]) => re.test(species))?.[1] ?? '🐾';
}
