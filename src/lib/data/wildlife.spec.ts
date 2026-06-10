import { describe, expect, it } from 'vitest';
import { wildlifeForZone, wildlifeZones } from './wildlife';
import { routes } from './routes';

describe('zones.json', () => {
	it('toda zona tiene nombre, especies con consejo y fuentes', () => {
		for (const [key, zone] of Object.entries(wildlifeZones)) {
			expect(zone.name, key).toBeTruthy();
			expect(zone.sources.length, `${key} sin fuentes`).toBeGreaterThan(0);
			for (const w of zone.wildlife) {
				expect(['bajo', 'medio', 'alto']).toContain(w.risk);
				expect(w.advice.length, `${key}/${w.species} sin consejo`).toBeGreaterThan(0);
			}
		}
	});

	it('ninguna zona de la CV incluye oso (SPEC §7)', () => {
		for (const zone of Object.values(wildlifeZones)) {
			for (const w of zone.wildlife) {
				expect(w.species.toLowerCase()).not.toContain('oso');
			}
		}
	});

	it('toda zona referenciada por una ruta existe en zones.json', () => {
		for (const route of routes) {
			if (route.zone !== null) {
				expect(wildlifeForZone(route.zone), `zona desconocida: ${route.zone}`).not.toBeNull();
			}
		}
	});

	it('wildlifeForZone devuelve null para zonas desconocidas o null', () => {
		expect(wildlifeForZone(null)).toBeNull();
		expect(wildlifeForZone('pirineos')).toBeNull();
	});
});
