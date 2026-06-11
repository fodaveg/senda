/**
 * Parsers puros del portal FEMECV (senders.femecv.com) para el crawler
 * (SPECS_V2 §4). Sin E/S: reciben HTML y devuelven datos tipados; la red
 * y los ficheros viven en crawl-cli.ts. Testeable con fixtures.
 */

import type { RouteStatus, RouteType } from '../../src/lib/types';
import type { CrawledData } from './schema';

export const PORTAL_BASE = 'https://senders.femecv.com';

/** Mapeo del literal de homologación del portal al enum de la app (SPECS_V2 §3). */
export function mapStatus(literal: string | null): RouteStatus {
	if (!literal) return 'desconocido';
	const l = literal.trim().toLowerCase();
	if (l === 'en vigor' || l === 'control de calidad positivo') return 'homologado';
	if (
		l === 'sin controles de calidad' ||
		l === 'control de calidad condicionado' ||
		l === 'control de calidad negativo'
	) {
		return 'con_reservas';
	}
	if (l === 'en proceso de homologación' || l === 'en proceso de revisión') return 'en_proceso';
	if (l === 'cancelación temporal' || l === 'baja / deshomologado') return 'deshabilitado';
	return 'desconocido';
}

/** "842 resultados" → 842; null si no aparece. */
export function parseResultCount(html: string): number | null {
	const match = html.match(/(\d+)\s*resultados/i);
	return match ? Number(match[1]) : null;
}

/** Slugs de ficha (/es/sendero/ver/<slug>) presentes en una página, únicos y ordenados. */
export function parseIndexSlugs(html: string): string[] {
	const slugs = new Set<string>();
	for (const match of html.matchAll(/\/es\/sendero\/ver\/([a-z0-9-]+)/g)) {
		slugs.add(match[1]);
	}
	return [...slugs].sort();
}

/** HTML → líneas de texto visible (sin scripts, estilos ni etiquetas). */
function visibleLines(html: string): string[] {
	const withoutBlocks = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
	const text = withoutBlocks
		.replace(/<[^>]+>/g, '\n')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&aacute;/g, 'á')
		.replace(/&eacute;/g, 'é')
		.replace(/&iacute;/g, 'í')
		.replace(/&oacute;/g, 'ó')
		.replace(/&uacute;/g, 'ú')
		.replace(/&ntilde;/g, 'ñ')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/** Valor de "Etiqueta:" — resto de la misma línea o la línea siguiente. */
function labelValue(lines: string[], label: string): string | null {
	const index = lines.findIndex((line) => line.startsWith(label));
	if (index === -1) return null;
	const sameLine = lines[index].slice(label.length).trim();
	if (sameLine) return sameLine;
	const next = lines[index + 1];
	return next && !next.endsWith(':') ? next : null;
}

/** "5,50 km" → 5.5; null si no parsea. */
export function parseKm(value: string | null): number | null {
	if (!value) return null;
	const match = value.replace(',', '.').match(/([\d.]+)\s*km/i);
	const km = match ? Number(match[1]) : NaN;
	return Number.isFinite(km) && km > 0 ? km : null;
}

/** "415 m" → 415; null si no parsea. */
export function parseMeters(value: string | null): number | null {
	if (!value) return null;
	const match = value.match(/(-?[\d.]+)\s*m/i);
	const meters = match ? Number(match[1].replace('.', '')) : NaN;
	return Number.isFinite(meters) && meters >= 0 ? meters : null;
}

/** "02:10:00" → 130 minutos; null si no parsea o es cero. */
export function parseDurationMin(value: string | null): number | null {
	if (!value) return null;
	const match = value.match(/(\d{1,3}):(\d{2})(?::(\d{2}))?/);
	if (!match) return null;
	const minutes = Number(match[1]) * 60 + Number(match[2]);
	return minutes > 0 ? minutes : null;
}

function parseMideValue(value: string | null): number | null {
	if (!value) return null;
	const n = Number(value.match(/^(\d)/)?.[1]);
	return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function typeFromSlug(slug: string): RouteType | null {
	if (slug.startsWith('gr-')) return 'GR';
	if (slug.startsWith('pr-')) return 'PR';
	if (slug.startsWith('sl-')) return 'SL';
	return null;
}

export class FichaParseError extends Error {}

/**
 * Ficha HTML → CrawledData. Lanza FichaParseError si faltan los campos
 * mínimos (nombre y tipo); el resto de campos ausentes quedan en null
 * (regla v1: nunca inventar).
 */
export function parseFicha(slug: string, html: string, crawledAt: string): CrawledData {
	const lines = visibleLines(html);

	// El nombre es la línea anterior a "Entidad promotora:" en la cabecera
	// de la ficha; como respaldo, la primera línea que empieza por el código.
	const promotoraIndex = lines.findIndex((line) => line.startsWith('Entidad promotora'));
	let name = promotoraIndex > 0 ? lines[promotoraIndex - 1] : null;
	if (!name || name.length < 3 || name.endsWith(':')) {
		name = lines.find((line) => /^(GR|PR|SL)[- ]/.test(line)) ?? null;
	}
	const type = typeFromSlug(slug);
	if (!name || !type) {
		throw new FichaParseError(`ficha de ${slug} sin nombre o tipo reconocible`);
	}

	const statusDetail = labelValue(lines, 'Estado de la homologación:');
	const recorrido = labelValue(lines, 'Recorrido:');

	const mide = {
		medio: parseMideValue(labelValue(lines, 'Severidad del medio natural:')),
		itinerario: parseMideValue(labelValue(lines, 'Orientación en el itinerario:')),
		desplazamiento: parseMideValue(labelValue(lines, 'Dificultad en el desplazamiento:')),
		esfuerzo: parseMideValue(labelValue(lines, 'Esfuerzo necesario:'))
	};
	const mideComplete =
		mide.medio !== null &&
		mide.itinerario !== null &&
		mide.desplazamiento !== null &&
		mide.esfuerzo !== null;

	const gpxMatch = html.match(/https:\/\/femecv\.blob\.core\.windows\.net\/[^"'\s]+\.gpx/i);

	return {
		name,
		type,
		status: mapStatus(statusDetail),
		status_detail: statusDetail,
		municipality: labelValue(lines, 'Municipio de referencia:'),
		comarca: labelValue(lines, 'Comarca:'),
		distance_km: parseKm(labelValue(lines, 'Distancia:')),
		ascent_m: parseMeters(labelValue(lines, 'Desnivel de subida:')),
		descent_m: parseMeters(labelValue(lines, 'Desnivel de bajada:')),
		circular: recorrido ? recorrido.toLowerCase().startsWith('circular') : null,
		difficulty_mide: mideComplete
			? {
					medio: mide.medio!,
					itinerario: mide.itinerario!,
					desplazamiento: mide.desplazamiento!,
					esfuerzo: mide.esfuerzo!
				}
			: null,
		est_duration_min: parseDurationMin(labelValue(lines, 'Horario teórico:')),
		start_name: labelValue(lines, 'Punto de partida:'),
		femecv_url: `${PORTAL_BASE}/es/sendero/ver/${slug}`,
		gpx_url: gpxMatch ? gpxMatch[0] : null,
		crawled_at: crawledAt
	};
}
