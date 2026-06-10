/** Fichas de fauna/riesgos por zona, estáticas en build (SPEC §7). */

import type { WildlifeZone } from '$lib/types';
import zonesJson from '../../../data/wildlife/zones.json';

export const wildlifeZones = zonesJson as Record<string, WildlifeZone>;

export function wildlifeForZone(zone: string | null): WildlifeZone | null {
	if (!zone) return null;
	return wildlifeZones[zone] ?? null;
}
