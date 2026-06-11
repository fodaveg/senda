/**
 * Ficha de emergencia (SPECS_V2 §9): documento para dejar a contactos
 * antes de salir. Reutiliza el modelo/render de informes (un modelo, tres
 * salidas: Markdown, imprimible y texto compacto para mensajería).
 * Puro, sin Svelte. Honestidad v1: horas derivadas marcadas como
 * estimación; campos vacíos se omiten.
 */

import { minutesToHhMm } from '$lib/engine/startWindow';
import type { EmergencySettings } from '$lib/settings';
import type { Route, WeatherDay } from '$lib/types';
import type { Aviso } from '$lib/weather/avisos';
import { formatDuration, formatKm, formatMeters } from '$lib/format';
import type { ReportBlock, ReportModel, ReportSection } from './model';

export interface EmergencyInput {
	route: Route;
	/** Fecha de la salida, YYYY-MM-DD. */
	date: string;
	/** Hora prevista de salida, "HH:MM". */
	startHhMm: string;
	/** Texto libre; vacío = va solo/a (se destaca). */
	companions: string;
	person: EmergencySettings;
	weather: WeatherDay | null;
	avisos: Aviso[] | null;
}

export interface EmergencyTimes {
	startMin: number;
	/** null = sin duración oficial: no se estima fin ni alarma. */
	endMin: number | null;
	alarmMin: number | null;
}

export function emergencyTimes(input: EmergencyInput): EmergencyTimes | null {
	const match = input.startHhMm.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	const startMin = Number(match[1]) * 60 + Number(match[2]);
	if (input.route.est_duration_min === null) {
		return { startMin, endMin: null, alarmMin: null };
	}
	const endMin = startMin + input.route.est_duration_min;
	return { startMin, endMin, alarmMin: endMin + input.person.alarmMarginMin };
}

function hhMmWithDay(minutes: number): string {
	return minutes >= 24 * 60 ? `${minutesToHhMm(minutes)} (día siguiente)` : minutesToHhMm(minutes);
}

export function osmLink(lat: number, lon: number): string {
	return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
}

export function buildEmergencyModel(input: EmergencyInput): ReportModel {
	const { route, date, person, weather, avisos, companions } = input;
	const times = emergencyTimes(input);
	const sections: ReportSection[] = [];

	// Quién va
	const whoFields: Array<{ label: string; value: string }> = [];
	if (person.name) whoFields.push({ label: 'Senderista', value: person.name });
	if (person.phone) whoFields.push({ label: 'Teléfono', value: person.phone });
	whoFields.push({
		label: 'Acompañantes',
		value: companions.trim() || 'VA SOLO/A'
	});
	if (person.medical) whoFields.push({ label: 'Datos médicos', value: person.medical });
	sections.push({ title: 'Quién va', blocks: [{ kind: 'fields', fields: whoFields }] });

	// La ruta
	const routeFields: Array<{ label: string; value: string }> = [
		{ label: 'Ruta', value: `${route.name} (${route.id})` },
		{ label: 'Distancia', value: formatKm(route.distance_km) },
		{
			label: 'Desnivel',
			value:
				route.ascent_m !== null
					? `+${formatMeters(route.ascent_m)} / −${formatMeters(route.descent_m ?? 0)}`
					: 'sin dato'
		},
		{
			label: 'Recorrido',
			value: route.circular === null ? 'sin dato' : route.circular ? 'circular' : 'lineal'
		},
		{
			label: 'Coordenadas del inicio',
			value: `${route.start.lat.toFixed(5)}, ${route.start.lon.toFixed(5)}${route.start.name ? ` (${route.start.name})` : ''}`
		},
		{ label: 'Mapa del inicio', value: osmLink(route.start.lat, route.start.lon) }
	];
	if (route.municipality) {
		routeFields.splice(1, 0, { label: 'Municipio', value: route.municipality });
	}
	if (route.links.femecv) {
		routeFields.push({ label: 'Ficha oficial FEMECV', value: route.links.femecv });
	}
	sections.push({
		title: 'La ruta',
		blocks: [
			{ kind: 'fields', fields: routeFields },
			{
				kind: 'paragraph',
				text: `El track GPX (${route.gpx}) está disponible en la app y puede adjuntarse a este documento: es lo más útil para los equipos de rescate.`
			}
		]
	});

	// Vehículo
	if (person.vehicle) {
		sections.push({
			title: 'Vehículo',
			blocks: [{ kind: 'paragraph', text: person.vehicle }]
		});
	}

	// Plan horario
	const planBlocks: ReportBlock[] = [];
	if (times) {
		const fields = [
			{ label: 'Fecha', value: date },
			{ label: 'Salida prevista', value: minutesToHhMm(times.startMin) }
		];
		if (route.est_duration_min !== null && times.endMin !== null && times.alarmMin !== null) {
			fields.push(
				{
					label: 'Duración estimada',
					value: `${formatDuration(route.est_duration_min)} (MIDE oficial; estimación)`
				},
				{ label: 'Fin estimado', value: hhMmWithDay(times.endMin) },
				{
					label: 'Hora del OK',
					value: `avisaré al terminar, hacia las ${hhMmWithDay(times.endMin)}`
				},
				{
					label: 'HORA LÍMITE DE ALARMA',
					value: `${hhMmWithDay(times.alarmMin)} — si a esa hora no he dado señales, actúa (ver abajo)`
				}
			);
		} else {
			fields.push({
				label: 'Duración',
				value: 'sin dato oficial — acordad una hora límite de alarma manualmente'
			});
		}
		planBlocks.push({ kind: 'fields', fields });
	}
	sections.push({ title: 'Plan horario', blocks: planBlocks });

	// Cobertura
	sections.push({
		title: 'Cobertura',
		blocks: [
			{
				kind: 'paragraph',
				text:
					'Durante la ruta la cobertura móvil puede ser limitada o nula: que no conteste ' +
					'entre la salida y la hora del OK es normal y no significa que pase nada.'
			}
		]
	});

	// Meteo prevista
	if (weather) {
		const meteoBlocks: ReportBlock[] = [
			{
				kind: 'paragraph',
				text:
					`Previsión: ${weather.temperature_2m_min}°–${weather.temperature_2m_max} °C, ` +
					`prob. de lluvia ${weather.precipitation_probability_max}%, UV máx. ${weather.uv_index_max}. ` +
					`Sol: ${weather.sunrise.slice(11, 16)}–${weather.sunset.slice(11, 16)}. ` +
					`Fuente: Open-Meteo, consultado ${weather.fetched_at}.`
			}
		];
		if (avisos && avisos.length > 0) {
			meteoBlocks.push({
				kind: 'list',
				items: avisos.map(
					(a) => `AVISO ${a.level.toUpperCase()}: ${a.event} (${a.areaDesc}). Fuente: AEMET.`
				)
			});
		}
		sections.push({ title: 'Meteorología prevista', blocks: meteoBlocks });
	}

	// Qué hacer
	sections.push({
		title: 'Si no doy señales a la hora límite',
		blocks: [
			{
				kind: 'list',
				items: [
					'Intenta contactar conmigo (llamada y mensaje).',
					'Si no respondo, llama al 112 (funciona con cualquier cobertura y sin saldo) e indica: ' +
						`nombre${person.name ? ` (${person.name})` : ''}, la ruta y su identificador (${route.id}), ` +
						'las coordenadas del inicio, la hora de salida' +
						`${person.vehicle ? ', el vehículo' : ''} y el último contacto que tuviste conmigo.`,
					'Conserva este documento y el track GPX para dárselos a los servicios de emergencia.'
				]
			}
		]
	});

	// Equipación visible
	if (person.clothing) {
		sections.push({
			title: 'Equipación visible',
			blocks: [{ kind: 'paragraph', text: person.clothing }]
		});
	}

	return {
		title: `Ficha de emergencia — ${route.name} — ${date}`,
		frontmatter: [
			['tipo', 'ficha-emergencia'],
			['ruta', route.name],
			['fecha', date],
			['salida', input.startHhMm],
			['hora_limite_alarma', times?.alarmMin != null ? hhMmWithDay(times.alarmMin) : null]
		],
		sections
	};
}

/** Texto compacto para WhatsApp/SMS. */
export function emergencyPlainText(input: EmergencyInput): string {
	const { route, date, person, companions } = input;
	const times = emergencyTimes(input);
	const lines: string[] = [
		`🥾 PLAN DE RUTA — ${route.name} (${date})`,
		`${person.name || 'Salgo de ruta'}${person.phone ? ` · tel. ${person.phone}` : ''} · ${companions.trim() ? `con ${companions.trim()}` : 'VOY SOLO/A'}`
	];
	if (times) {
		const plan = [`Salida ${minutesToHhMm(times.startMin)}`];
		if (times.endMin !== null) plan.push(`fin estimado ${hhMmWithDay(times.endMin)}`);
		lines.push(plan.join(' · '));
		if (times.alarmMin !== null) {
			lines.push(`⚠ SI A LAS ${hhMmWithDay(times.alarmMin)} NO HE AVISADO, LLAMA AL 112`);
		} else {
			lines.push('⚠ Sin duración oficial: acordamos hora límite aparte. Si no aviso, 112.');
		}
	}
	lines.push(
		`Inicio: ${route.start.lat.toFixed(5)}, ${route.start.lon.toFixed(5)} ${osmLink(route.start.lat, route.start.lon)}`
	);
	if (person.vehicle) lines.push(`Vehículo: ${person.vehicle}`);
	lines.push('Habrá poca cobertura: el silencio hasta la hora del OK es normal.');
	lines.push(
		`Al 112: mi nombre, la ruta ${route.id}, las coordenadas del inicio y la hora de salida.`
	);
	return lines.join('\n');
}

export function emergencyFilename(routeId: string, date: string): string {
	return `emergencia-${routeId}-${date}.md`;
}
