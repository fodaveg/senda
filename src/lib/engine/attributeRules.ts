/**
 * Anti-reglas y vocabulario del material custom (SPECS_V3 §4). Curadas a mano,
 * como `rules.json`: cada una desaconseja un atributo cuando las condiciones de
 * ruta/meteo lo hacen contraproducente. Puro: datos tipados, sin lógica.
 *
 * Solo avisan ante un dato verificado (la evaluación es fail-safe: sin meteo no
 * se desaconseja nada). El ejemplo guía —calcetines impermeables (impermeable +
 * abrigo) en ruta calurosa— lo cubre la regla de `abrigo` con calor.
 */

import type { AttributeWarningRule, GearAttribute } from '$lib/types';

/** Etiquetas legibles del vocabulario de atributos (UI). */
export const ATTRIBUTE_LABELS: Record<GearAttribute, string> = {
	impermeable: 'Impermeable',
	abrigo: 'Abrigo',
	ventilado: 'Ventilado / fresco',
	aislante: 'Aislante térmico',
	sol: 'Protección solar',
	lluvia: 'Para lluvia',
	calzado: 'Calzado',
	tecnico: 'Técnico'
};

/** Atributos disponibles para el selector, en el orden de presentación. */
export const GEAR_ATTRIBUTES: GearAttribute[] = Object.keys(ATTRIBUTE_LABELS) as GearAttribute[];

export const ATTRIBUTE_WARNING_RULES: AttributeWarningRule[] = [
	{
		attribute: 'abrigo',
		when: { temperature_2m_max: { gte: 26 } },
		reason: 'Prenda de abrigo con {temperature_2m_max} °C: riesgo de exceso de calor'
	},
	{
		attribute: 'aislante',
		when: { temperature_2m_max: { gte: 28 } },
		reason: 'Material aislante con {temperature_2m_max} °C: probablemente sobre'
	},
	{
		attribute: 'impermeable',
		when: { precipitation_probability_max: { lt: 5 }, temperature_2m_max: { gte: 26 } },
		reason:
			'Impermeable con calor ({temperature_2m_max} °C) y sin lluvia prevista: peso y calor innecesarios'
	},
	{
		attribute: 'ventilado',
		when: { temperature_2m_min: { lte: 2 } },
		reason:
			'Prenda muy ventilada con {temperature_2m_min} °C de mínima: poca protección frente al frío'
	}
];
