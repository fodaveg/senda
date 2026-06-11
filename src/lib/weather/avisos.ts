/**
 * Avisos meteorológicos oficiales de AEMET (SPECS_V2 §5): mensajes CAP
 * del área 77 (Comunitat Valenciana) vía AEMET OpenData (api key opcional
 * de ajustes). El endpoint entrega un .tar con un XML CAP por aviso; aquí
 * hay un lector tar mínimo (cabeceras de 512 bytes) y un parser CAP.
 *
 * Puro, fetch/DOMParser inyectables, testeable con fixtures. Nunca se
 * afirma "sin avisos" si no se pudo consultar.
 */

import { z } from 'zod';
import { AemetAuthError, AemetRateLimitError, type KeyValueStorage } from './aemet';

export const AVISOS_AREA_CV = '77';

export type AvisoLevel = 'amarillo' | 'naranja' | 'rojo';

export interface Aviso {
	/** Fenómeno ("Tormentas", "Temperaturas máximas"…). */
	event: string;
	level: AvisoLevel;
	/** Zona de aviso en texto ("Litoral sur de Valencia"…). */
	areaDesc: string;
	/** Vigencia, ISO local. */
	onset: string;
	expires: string;
}

const envelopeSchema = z.object({
	estado: z.number(),
	datos: z.url().optional(),
	descripcion: z.string().optional()
});

export function avisosUrl(area: string): string {
	return `https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/${area}`;
}

// ─── tar mínimo ─────────────────────────────────────────────────────────────

/** Entradas de fichero de un tar (POSIX ustar): [{ name, content }]. */
export function untar(buffer: ArrayBuffer): Array<{ name: string; content: string }> {
	const bytes = new Uint8Array(buffer);
	const decoder = new TextDecoder('utf-8');
	const files: Array<{ name: string; content: string }> = [];
	let offset = 0;
	while (offset + 512 <= bytes.length) {
		const header = bytes.subarray(offset, offset + 512);
		if (header.every((b) => b === 0)) break; // bloque final
		const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '');
		const sizeOctal = decoder.decode(header.subarray(124, 136)).replace(/[^0-7]/g, '');
		const size = parseInt(sizeOctal || '0', 8);
		const typeFlag = String.fromCharCode(header[156]);
		const content = bytes.subarray(offset + 512, offset + 512 + size);
		if (typeFlag === '0' || typeFlag === '\0') {
			files.push({ name, content: decoder.decode(content) });
		}
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	return files;
}

// ─── parser CAP ─────────────────────────────────────────────────────────────

function textOf(parent: Element, tag: string): string | null {
	const el = parent.getElementsByTagName(tag)[0];
	return el?.textContent?.trim() || null;
}

/** Nivel del parámetro Meteoalerta ("AEMET-Meteoalerta nivel"). */
function levelOf(info: Element): AvisoLevel | null {
	for (const parameter of Array.from(info.getElementsByTagName('parameter'))) {
		const name = textOf(parameter, 'valueName')?.toLowerCase() ?? '';
		if (name.includes('nivel')) {
			const value = textOf(parameter, 'value')?.toLowerCase() ?? '';
			if (value === 'amarillo' || value === 'naranja' || value === 'rojo') return value;
		}
	}
	return null;
}

/**
 * XML CAP → avisos (uno por área del bloque info en español). Los avisos
 * de nivel verde (sin riesgo) se descartan.
 */
export function parseCap(xml: string, parser: DOMParser = new DOMParser()): Aviso[] {
	const doc = parser.parseFromString(xml, 'text/xml');
	const avisos: Aviso[] = [];
	for (const info of Array.from(doc.getElementsByTagName('info'))) {
		const language = textOf(info, 'language') ?? 'es-ES';
		if (!language.toLowerCase().startsWith('es')) continue;
		const level = levelOf(info);
		const event = textOf(info, 'event');
		const onset = textOf(info, 'onset') ?? textOf(info, 'effective');
		const expires = textOf(info, 'expires');
		if (!level || !event || !onset || !expires) continue;
		for (const area of Array.from(info.getElementsByTagName('area'))) {
			const areaDesc = textOf(area, 'areaDesc');
			if (!areaDesc) continue;
			avisos.push({ event, level, areaDesc, onset, expires });
		}
	}
	return avisos;
}

// ─── filtrado por ruta y fecha ──────────────────────────────────────────────

function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

/**
 * Provincia de una ruta a partir de su comarca (zone). Mapa estático de
 * las comarcas oficiales de la CV; las no listadas devuelven null y el
 * aviso no se filtra por provincia (se muestra igual: fail-safe).
 */
const VALENCIA = [
	'serranos',
	'rincon-de-ademuz',
	'camp-de-turia',
	'camp-de-morvedre',
	'horta-nord',
	'horta-oest',
	'horta-sud',
	'valencia',
	'hoya-de-bunol',
	'valle-de-ayora',
	'ribera-alta',
	'ribera-baixa',
	'canal-de-navarres',
	'costera',
	'vall-d-albaida',
	'safor'
];
const ALICANTE = [
	'comtat',
	'alcoia',
	'alt-vinalopo',
	'vinalopo-mitja',
	'marina-alta',
	'marina-baixa',
	'alacanti',
	'baix-vinalopo',
	'baix-segura-vega-baja'
];
const CASTELLON = [
	'ports',
	'alt-maestrat',
	'baix-maestrat',
	'alcalaten',
	'alto-mijares',
	'alto-palancia',
	'plana-alta',
	'plana-baixa'
];

export function provinceOfZone(zone: string | null): string | null {
	if (!zone) return null;
	if (VALENCIA.includes(zone)) return 'valencia';
	if (ALICANTE.includes(zone)) return 'alicante';
	if (CASTELLON.includes(zone)) return 'castellon';
	return null;
}

/**
 * Avisos relevantes para una ruta y fecha: vigencia que solapa el día y
 * zona de aviso de la misma provincia (si la provincia no se puede
 * determinar, no se filtra: mejor un aviso de más que uno de menos).
 */
export function avisosForRoute(avisos: Aviso[], zone: string | null, date: string): Aviso[] {
	const province = provinceOfZone(zone);
	const dayStart = `${date}T00:00`;
	const dayEnd = `${date}T23:59`;
	return avisos.filter((aviso) => {
		if (aviso.onset.slice(0, 16) > dayEnd || aviso.expires.slice(0, 16) < dayStart) return false;
		if (province === null) return true;
		const desc = normalize(aviso.areaDesc);
		return desc.includes(province) || desc.includes(province === 'castellon' ? 'castello' : '~');
	});
}

// ─── cliente ────────────────────────────────────────────────────────────────

export async function fetchAvisosCap(
	apiKey: string,
	area: string = AVISOS_AREA_CV,
	fetchFn: typeof fetch = fetch,
	parser?: DOMParser
): Promise<Aviso[]> {
	const envelopeResponse = await fetchFn(`${avisosUrl(area)}?api_key=${apiKey}`);
	if (envelopeResponse.status === 401 || envelopeResponse.status === 403) {
		throw new AemetAuthError(`AEMET rechazó la api key (${envelopeResponse.status})`);
	}
	if (envelopeResponse.status === 429) {
		throw new AemetRateLimitError('AEMET respondió 429 (límite de peticiones)');
	}
	if (!envelopeResponse.ok) throw new Error(`AEMET avisos respondió ${envelopeResponse.status}`);
	const envelope = envelopeSchema.safeParse(await envelopeResponse.json());
	if (!envelope.success || !envelope.data.datos) {
		// Sin avisos elaborados el endpoint puede no dar URL de datos.
		if (envelope.success && envelope.data.estado === 404) return [];
		throw new Error('AEMET avisos no devolvió URL de datos');
	}
	const dataResponse = await fetchFn(envelope.data.datos);
	if (!dataResponse.ok) throw new Error(`AEMET avisos (datos) respondió ${dataResponse.status}`);
	const buffer = await dataResponse.arrayBuffer();
	const avisos: Aviso[] = [];
	for (const file of untar(buffer)) {
		if (!file.name.toLowerCase().endsWith('.xml')) continue;
		try {
			avisos.push(...parseCap(file.content, parser));
		} catch {
			// Un XML corrupto no tumba el resto de avisos.
		}
	}
	return avisos;
}

/** Vigencia corta: los avisos cambian más que el pronóstico municipal. */
const AVISOS_CACHE_TTL_MS = 30 * 60 * 1000;

interface AvisosCacheEntry {
	at: number;
	avisos: Aviso[];
}

/** Como fetchAvisosCap pero con caché por área (TTL 30 min). */
export async function fetchAvisosCapCached(
	apiKey: string,
	area: string = AVISOS_AREA_CV,
	opts: {
		fetchFn?: typeof fetch;
		storage?: KeyValueStorage | null;
		now?: () => number;
		parser?: DOMParser;
	} = {}
): Promise<Aviso[]> {
	const fetchFn = opts.fetchFn ?? fetch;
	const storage = opts.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
	const now = opts.now ?? Date.now;
	const key = `senderos-cv:avisos:${area}`;

	if (storage) {
		try {
			const raw = storage.getItem(key);
			if (raw) {
				const cached = JSON.parse(raw) as Partial<AvisosCacheEntry>;
				if (
					typeof cached.at === 'number' &&
					Array.isArray(cached.avisos) &&
					now() - cached.at < AVISOS_CACHE_TTL_MS
				) {
					return cached.avisos;
				}
			}
		} catch {
			// Caché corrupta: se ignora.
		}
	}
	const avisos = await fetchAvisosCap(apiKey, area, fetchFn, opts.parser);
	if (storage) {
		try {
			storage.setItem(key, JSON.stringify({ at: now(), avisos } satisfies AvisosCacheEntry));
		} catch {
			// Solo optimización.
		}
	}
	return avisos;
}
