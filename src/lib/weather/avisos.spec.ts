import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import {
	avisosForRoute,
	fetchAvisosCap,
	parseCap,
	provinceOfZone,
	untar,
	type Aviso
} from './avisos';
import { normalizeHourly } from './hourly';

/** Fixture CAP con la estructura de los avisos Meteoalerta de AEMET. */
const CAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
	<identifier>x</identifier>
	<info>
		<language>es-ES</language>
		<event>Tormentas</event>
		<onset>2026-06-14T12:00:00+02:00</onset>
		<expires>2026-06-14T20:59:59+02:00</expires>
		<parameter>
			<valueName>AEMET-Meteoalerta nivel</valueName>
			<value>naranja</value>
		</parameter>
		<area>
			<areaDesc>Interior norte de Valencia</areaDesc>
			<geocode><valueName>AEMET-Meteoalerta zona</valueName><value>771203</value></geocode>
		</area>
	</info>
	<info>
		<language>en-GB</language>
		<event>Thunderstorms</event>
		<onset>2026-06-14T12:00:00+02:00</onset>
		<expires>2026-06-14T20:59:59+02:00</expires>
		<parameter><valueName>AEMET-Meteoalerta nivel</valueName><value>naranja</value></parameter>
		<area><areaDesc>Inland north of Valencia</areaDesc></area>
	</info>
	<info>
		<language>es-ES</language>
		<event>Viento</event>
		<onset>2026-06-14T00:00:00+02:00</onset>
		<expires>2026-06-14T23:59:59+02:00</expires>
		<parameter><valueName>AEMET-Meteoalerta nivel</valueName><value>verde</value></parameter>
		<area><areaDesc>Litoral de Castellón</areaDesc></area>
	</info>
</alert>`;

const domParser = new DOMParser() as unknown as globalThis.DOMParser;

/** tar mínimo en memoria con un fichero. */
function tarWith(name: string, content: string): ArrayBuffer {
	const encoder = new TextEncoder();
	const body = encoder.encode(content);
	const blocks = Math.ceil(body.length / 512);
	const buffer = new Uint8Array(512 + blocks * 512 + 1024);
	const header = new Uint8Array(512);
	header.set(encoder.encode(name), 0);
	const sizeOctal = body.length.toString(8).padStart(11, '0') + ' ';
	header.set(encoder.encode(sizeOctal), 124);
	header[156] = '0'.charCodeAt(0);
	buffer.set(header, 0);
	buffer.set(body, 512);
	return buffer.buffer;
}

describe('untar', () => {
	it('extrae nombre y contenido de un tar POSIX', () => {
		const files = untar(tarWith('Z_CAP_AFAZ77.xml', '<alert>hola</alert>'));
		expect(files).toHaveLength(1);
		expect(files[0].name).toBe('Z_CAP_AFAZ77.xml');
		expect(files[0].content).toBe('<alert>hola</alert>');
	});
});

describe('parseCap', () => {
	it('extrae los avisos en español con nivel ≥ amarillo', () => {
		const avisos = parseCap(CAP_XML, domParser);
		expect(avisos).toHaveLength(1);
		expect(avisos[0]).toMatchObject({
			event: 'Tormentas',
			level: 'naranja',
			areaDesc: 'Interior norte de Valencia'
		});
	});
});

describe('avisosForRoute', () => {
	const avisos: Aviso[] = [
		{
			event: 'Tormentas',
			level: 'naranja',
			areaDesc: 'Interior norte de Valencia',
			onset: '2026-06-14T12:00:00+02:00',
			expires: '2026-06-14T20:59:59+02:00'
		},
		{
			event: 'Viento',
			level: 'amarillo',
			areaDesc: 'Litoral de Castellón',
			onset: '2026-06-14T00:00:00+02:00',
			expires: '2026-06-14T23:59:59+02:00'
		}
	];

	it('filtra por provincia de la comarca y por vigencia', () => {
		expect(avisosForRoute(avisos, 'serranos', '2026-06-14').map((a) => a.event)).toEqual([
			'Tormentas'
		]);
		expect(avisosForRoute(avisos, 'ports', '2026-06-14').map((a) => a.event)).toEqual(['Viento']);
		expect(avisosForRoute(avisos, 'serranos', '2026-06-20')).toHaveLength(0);
	});

	it('comarca desconocida → no se filtra por provincia (fail-safe)', () => {
		expect(avisosForRoute(avisos, 'comarca-rara', '2026-06-14')).toHaveLength(2);
		expect(provinceOfZone('comarca-rara')).toBeNull();
		expect(provinceOfZone('marina-alta')).toBe('alicante');
	});
});

describe('fetchAvisosCap (dos pasos + tar)', () => {
	it('sigue la URL de datos, descomprime el tar y parsea los CAP', async () => {
		const tar = tarWith('aviso1.xml', CAP_XML);
		const fakeFetch = (async (url: string | URL) => {
			if (String(url).includes('opendata.aemet.es')) {
				return new Response(JSON.stringify({ estado: 200, datos: 'https://datos.example/t' }));
			}
			return new Response(tar);
		}) as unknown as typeof fetch;
		const avisos = await fetchAvisosCap('KEY', '77', fakeFetch, domParser);
		expect(avisos).toHaveLength(1);
		expect(avisos[0].event).toBe('Tormentas');
	});

	it('estado 404 (sin avisos elaborados) → lista vacía, no error', async () => {
		const fakeFetch = (async () =>
			new Response(
				JSON.stringify({ estado: 404, descripcion: 'No hay datos' })
			)) as unknown as typeof fetch;
		expect(await fetchAvisosCap('KEY', '77', fakeFetch, domParser)).toEqual([]);
	});
});

describe('normalizeHourly', () => {
	it('descarta horas con valores null', () => {
		const points = normalizeHourly({
			hourly: {
				time: ['2026-06-14T06:00', '2026-06-14T07:00'],
				temperature_2m: [20, null],
				uv_index: [1, 2],
				precipitation_probability: [0, 0]
			}
		});
		expect(points).toHaveLength(1);
		expect(points[0].time).toBe('2026-06-14T06:00');
	});

	it('rechaza payloads con forma inesperada', () => {
		expect(() => normalizeHourly({ no: 'es' })).toThrow(/Open-Meteo/);
	});
});
