import { describe, expect, it } from 'vitest';
import { wildlifeForZone, wildlifeEmoji, wildlifeZones } from './wildlife';
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

	// SPECS_V2 §3: zone es la comarca de la ficha FEMECV; puede no tener ficha
	// de fauna todavía (la UI la omite). El invariante inverso sí se exige:
	it('toda ficha de fauna corresponde a una comarca real del catálogo', () => {
		const referenced = new Set(routes.map((r) => r.zone).filter((z) => z !== null));
		for (const key of Object.keys(wildlifeZones)) {
			expect(referenced.has(key), `zona ${key} sin ninguna ruta que la use`).toBe(true);
		}
	});

	it('wildlifeForZone devuelve null para zonas desconocidas o null', () => {
		expect(wildlifeForZone(null)).toBeNull();
		expect(wildlifeForZone('pirineos')).toBeNull();
	});
});

describe('wildlifeEmoji', () => {
	it('mapea por palabra clave, sin distinguir mayúsculas ni acentos del patrón', () => {
		expect(wildlifeEmoji('Cabra montés')).toBe('🐐');
		expect(wildlifeEmoji('Muflón')).toBe('🐐');
		expect(wildlifeEmoji('Jabalí')).toBe('🐗');
		expect(wildlifeEmoji('Víbora hocicuda')).toBe('🐍');
		expect(wildlifeEmoji('Culebra bastarda')).toBe('🐍');
		expect(wildlifeEmoji('Águila real')).toBe('🦅');
		expect(wildlifeEmoji('Perro de ganado (mastín)')).toBe('🐕');
	});

	it('respaldo de huella cuando no hay patrón que case', () => {
		expect(wildlifeEmoji('Lince ibérico')).toBe('🐾');
		expect(wildlifeEmoji('')).toBe('🐾');
	});

	it('el primer patrón que casa gana (ganado mastín → perro, no cabra)', () => {
		// "ganado" casa con la regla del perro; ninguna especie real debería
		// devolver dos iconos, pero fijamos el determinismo.
		expect(wildlifeEmoji('perro')).toBe('🐕');
	});

	it('cada especie real del catálogo recibe un emoji no vacío', () => {
		for (const zone of Object.values(wildlifeZones)) {
			for (const w of zone.wildlife) {
				expect(wildlifeEmoji(w.species), w.species).toBeTruthy();
			}
		}
	});
});
