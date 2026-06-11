import { describe, expect, it } from 'vitest';
import {
	mapStatus,
	parseDurationMin,
	parseFicha,
	parseIndexSlugs,
	parseKm,
	parseMeters,
	parseResultCount
} from './crawl';

/** Fixture mínima con la estructura real de la ficha del portal FEMECV. */
const FICHA = `<!DOCTYPE html><html><head><script>var x = 1;</script></head><body>
<div><h2>Valora la ruta</h2>
<h1>PR-CV 77 CHULILLA A SOT DE CHERA</h1>
<p>Entidad promotora: Ayuntamiento de Chulilla</p>
<p>Estado de la homologación: Sin controles de calidad</p>
<dl>
<dt>Recorrido:</dt><dd>Lineal</dd>
<dt>Distancia:</dt><dd>5,50 km</dd>
<dt>Horario teórico:</dt><dd>02:10:00</dd>
<dt>Desnivel de subida:</dt><dd>415 m</dd>
<dt>Desnivel de bajada:</dt><dd>290 m</dd>
<dt>Severidad del medio natural:</dt><dd>1</dd>
<dt>Orientación en el itinerario:</dt><dd>2</dd>
<dt>Dificultad en el desplazamiento:</dt><dd>2</dd>
<dt>Esfuerzo necesario:</dt><dd>2</dd>
<dt>Punto de partida:</dt><dd>Plaza de la Baronia. Chulilla</dd>
<dt>Municipio de referencia:</dt><dd>Chulilla</dd>
<dt>Comarca:</dt><dd>Los Serranos</dd>
</dl>
<a href="https://femecv.blob.core.windows.net/publico/gpx/TRACKPRCV077.gpx">GPX</a>
</body></html>`;

describe('parseFicha', () => {
	it('extrae todos los campos publicados de la ficha', () => {
		const c = parseFicha('pr-cv-77', FICHA, '2026-06-11T12:00:00Z');
		expect(c).toMatchObject({
			name: 'PR-CV 77 CHULILLA A SOT DE CHERA',
			type: 'PR',
			status: 'con_reservas',
			status_detail: 'Sin controles de calidad',
			municipality: 'Chulilla',
			comarca: 'Los Serranos',
			distance_km: 5.5,
			ascent_m: 415,
			descent_m: 290,
			circular: false,
			est_duration_min: 130,
			start_name: 'Plaza de la Baronia. Chulilla',
			gpx_url: 'https://femecv.blob.core.windows.net/publico/gpx/TRACKPRCV077.gpx'
		});
		expect(c.difficulty_mide).toEqual({
			medio: 1,
			itinerario: 2,
			desplazamiento: 2,
			esfuerzo: 2
		});
	});

	it('campos ausentes quedan en null, nunca inventados', () => {
		const minimal = `<html><body><p>Entidad promotora: X</p><h1>SL-CV 1 PRUEBA</h1></body></html>`;
		// El nombre cae al respaldo (línea que empieza por el código).
		const c = parseFicha('sl-cv-1', minimal, '2026-06-11T12:00:00Z');
		expect(c.name).toBe('SL-CV 1 PRUEBA');
		expect(c.status).toBe('desconocido');
		expect(c.distance_km).toBeNull();
		expect(c.difficulty_mide).toBeNull();
		expect(c.gpx_url).toBeNull();
	});

	it('ficha irreconocible → FichaParseError', () => {
		expect(() => parseFicha('x-1', '<html><body>nada</body></html>', 'x')).toThrow(/x-1/);
	});
});

describe('mapStatus (taxonomía real del portal → enum de la app)', () => {
	it('mapea los 9 literales del buscador del portal', () => {
		expect(mapStatus('En vigor')).toBe('homologado');
		expect(mapStatus('Control de calidad positivo')).toBe('homologado');
		expect(mapStatus('Sin controles de calidad')).toBe('con_reservas');
		expect(mapStatus('Control de calidad condicionado')).toBe('con_reservas');
		expect(mapStatus('Control de calidad negativo')).toBe('con_reservas');
		expect(mapStatus('En proceso de homologación')).toBe('en_proceso');
		expect(mapStatus('En proceso de revisión')).toBe('en_proceso');
		expect(mapStatus('Cancelación temporal')).toBe('deshabilitado');
		expect(mapStatus('Baja / Deshomologado')).toBe('deshabilitado');
	});

	it('literal nuevo o ausente → desconocido (nunca se inventa)', () => {
		expect(mapStatus('Estado inventado por el portal')).toBe('desconocido');
		expect(mapStatus(null)).toBe('desconocido');
	});
});

describe('parsers de listado y valores', () => {
	it('parseResultCount y parseIndexSlugs', () => {
		const html = `<p>842 resultados</p>
			<a href="/es/sendero/ver/pr-cv-77">x</a>
			<a href="/es/sendero/ver/gr-7-e38">y</a>
			<a href="/es/sendero/ver/pr-cv-77">repetido</a>`;
		expect(parseResultCount(html)).toBe(842);
		expect(parseIndexSlugs(html)).toEqual(['gr-7-e38', 'pr-cv-77']);
	});

	it('parseKm/parseMeters/parseDurationMin con formatos del portal', () => {
		expect(parseKm('5,50 km')).toBe(5.5);
		expect(parseKm('12.9 km')).toBe(12.9);
		expect(parseKm('sin dato')).toBeNull();
		expect(parseMeters('415 m')).toBe(415);
		expect(parseMeters(null)).toBeNull();
		expect(parseDurationMin('02:10:00')).toBe(130);
		expect(parseDurationMin('00:45:00')).toBe(45);
		expect(parseDurationMin('Sin determinar')).toBeNull();
	});
});
