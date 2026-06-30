import { describe, expect, it } from 'vitest';
import {
	buildRoute,
	etapaOrder,
	geojsonToSegments,
	groupSenderos,
	idenaLayer,
	segmentsToGpx,
	reproject25830,
	senderoId,
	senderoMatricula,
	trackSummary,
	type MapaEtapa
} from './navarra';
import { routeSchema } from '../../../src/lib/data/schema';
import type { FeatureCollection } from 'geojson';

describe('Navarra: matrícula y capas', () => {
	it('senderoMatricula recorta la etapa', () => {
		expect(senderoMatricula('GR 11. Etapa 1')).toBe('GR 11');
		expect(senderoMatricula('GR 11. Etapa 8a')).toBe('GR 11');
		expect(senderoMatricula('PR-NA 121')).toBe('PR-NA 121');
	});

	it('idenaLayer normaliza la matrícula a la capa', () => {
		expect(idenaLayer('GR 11')).toBe('DOTACI_Lin_GR11');
		expect(idenaLayer('PR-NA 121')).toBe('DOTACI_Lin_PRNA121');
		expect(idenaLayer('SL-NA 54')).toBe('DOTACI_Lin_SLNA54');
		// Ceros a la izquierda del número final ("GR T 03" → capa "GRT3").
		expect(idenaLayer('GR T 03')).toBe('DOTACI_Lin_GRT3');
		expect(idenaLayer('GR 220')).toBe('DOTACI_Lin_GR220');
	});

	it('senderoId y etapaOrder', () => {
		expect(senderoId('GR 11')).toBe('na-gr-11');
		expect(senderoId('PR-NA 121')).toBe('na-pr-na-121');
		expect(etapaOrder('GR 11. Etapa 04')).toBe(4);
		expect(etapaOrder('GR 11. Etapa 8a')).toBe(8);
		expect(etapaOrder('PR-NA 121')).toBe(1);
	});
});

describe('groupSenderos', () => {
	const etapas: MapaEtapa[] = [
		{
			matricula: 'GR 11. Etapa 2',
			codi_matricula: 'GR',
			titulo: 'GR 11. Etapa 2 - Bera - Elizondo',
			gr_parent_titulo: 'GR 11 - Senda Pirenaica. Navarra',
			permalink: 'x',
			id: '2'
		},
		{
			matricula: 'GR 11. Etapa 1',
			codi_matricula: 'GR',
			titulo: 'GR 11. Etapa 1 - San Antón - Bera',
			gr_parent_titulo: 'GR 11 - Senda Pirenaica. Navarra',
			permalink: 'y',
			id: '1'
		},
		{
			matricula: 'PR-NA 121',
			codi_matricula: 'PR',
			titulo: 'PR-NA 121 - Subida al Monte',
			gr_parent_titulo: '',
			permalink: 'z',
			id: '3'
		}
	];

	it('agrupa por sendero, ordena etapas y limpia el nombre', () => {
		const s = groupSenderos(etapas);
		expect(s).toHaveLength(2);
		const gr = s.find((x) => x.matricula === 'GR 11')!;
		expect(gr.id).toBe('na-gr-11');
		expect(gr.idenaLayer).toBe('DOTACI_Lin_GR11');
		expect(gr.name).toBe('GR 11 - Senda Pirenaica');
		expect(gr.etapas.map((e) => e.order)).toEqual([1, 2]);
		// El PR de una sola etapa también se incluye.
		expect(s.some((x) => x.matricula === 'PR-NA 121')).toBe(true);
	});
});

describe('reproject25830', () => {
	it('lleva un punto IDENA (UTM 30N) a coordenadas de Navarra', () => {
		const [lon, lat] = reproject25830([620565.08, 4778078.0]);
		expect(lon).toBeGreaterThan(-2);
		expect(lon).toBeLessThan(-1);
		expect(lat).toBeGreaterThan(42.5);
		expect(lat).toBeLessThan(43.5);
	});
});

describe('geometría → resumen → GPX → Route', () => {
	const fc: FeatureCollection = {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'MultiLineString',
					coordinates: [
						[
							[620565.08, 4778078.0],
							[620700.0, 4778200.0]
						]
					]
				}
			}
		]
	};

	it('aplana, resume y construye una Route válida con etapas_meta', () => {
		const segments = geojsonToSegments(fc);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toHaveLength(2);
		const summary = trackSummary(segments)!;
		expect(summary.distance_km).toBeGreaterThan(0);

		const gpx = segmentsToGpx(segments, 'GR 11');
		expect(gpx).toContain('<trkseg>');
		expect(gpx).toContain('<trkpt');

		const route = buildRoute(
			{
				matricula: 'GR 11',
				name: 'GR 11 - Senda Pirenaica',
				type: 'GR',
				idenaLayer: 'DOTACI_Lin_GR11',
				id: 'na-gr-11',
				permalink: 'https://misendafedme.es/x',
				etapas: [
					{ order: 1, name: 'Etapa 1' },
					{ order: 2, name: 'Etapa 2' }
				]
			},
			summary,
			'2026-06-30'
		);
		// Debe validar contra el esquema runtime (strict).
		const parsed = routeSchema.safeParse(route);
		expect(parsed.success).toBe(true);
		expect(route.federacion).toBe('FNDME');
		expect(route.ascent_m).toBeNull(); // IDENA 2D: no se inventa
		expect(route.etapas_meta).toHaveLength(2);
	});

	it('trackSummary devuelve null con menos de 2 puntos', () => {
		expect(trackSummary([])).toBeNull();
	});
});
