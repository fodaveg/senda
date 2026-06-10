import { describe, expect, it } from 'vitest';
import { compareForecasts, fetchAemetForecast, normalizeAemet, type AemetDay } from './aemet';
import type { WeatherDay } from '$lib/types';

const AEMET_DATA = [
	{
		nombre: 'Chulilla',
		prediccion: {
			dia: [
				{
					fecha: '2026-06-14T00:00:00',
					probPrecipitacion: [
						{ value: 10, periodo: '00-12' },
						{ value: 55, periodo: '12-24' }
					],
					temperatura: { maxima: 31, minima: 17 },
					uvMax: 9
				},
				{
					fecha: '2026-06-15T00:00:00',
					probPrecipitacion: [{ value: null }],
					temperatura: { maxima: null, minima: null }
				}
			]
		}
	}
];

describe('normalizeAemet', () => {
	it('toma la probabilidad máxima de los periodos y normaliza la fecha', () => {
		const days = normalizeAemet(AEMET_DATA, '2026-06-13T18:00:00Z');
		expect(days).toHaveLength(1);
		expect(days[0]).toMatchObject({
			date: '2026-06-14',
			precipitation_probability_max: 55,
			temperature_2m_max: 31,
			uv_index_max: 9,
			source: 'aemet'
		});
	});

	it('descarta días sin datos completos en vez de inventarlos', () => {
		expect(normalizeAemet(AEMET_DATA, 'x').map((d) => d.date)).toEqual(['2026-06-14']);
	});

	it('rechaza payloads con forma inesperada', () => {
		expect(() => normalizeAemet({ no: 'es-aemet' }, 'x')).toThrow(/AEMET/);
	});
});

describe('fetchAemetForecast (dos pasos)', () => {
	it('sigue la URL de datos del sobre y normaliza', async () => {
		const calls: string[] = [];
		const fakeFetch = (async (url: string | URL) => {
			calls.push(String(url));
			if (String(url).includes('opendata.aemet.es')) {
				return new Response(JSON.stringify({ estado: 200, datos: 'https://datos.example/x' }));
			}
			return new Response(JSON.stringify(AEMET_DATA));
		}) as unknown as typeof fetch;
		const days = await fetchAemetForecast('46112', 'KEY', fakeFetch);
		expect(calls[0]).toContain('/municipio/diaria/46112');
		expect(calls[1]).toBe('https://datos.example/x');
		expect(days).toHaveLength(1);
	});

	it('falla con descripción clara si AEMET no da URL de datos', async () => {
		const fakeFetch = (async () =>
			new Response(
				JSON.stringify({ estado: 401, descripcion: 'api key invalida' })
			)) as unknown as typeof fetch;
		await expect(fetchAemetForecast('46112', 'MALA', fakeFetch)).rejects.toThrow(
			/api key invalida/
		);
	});
});

describe('compareForecasts', () => {
	const openMeteo = {
		precipitation_probability_max: 20,
		temperature_2m_max: 30
	} as WeatherDay;

	function aemetWith(prob: number, tempMax: number): AemetDay {
		return {
			date: '2026-06-14',
			temperature_2m_max: tempMax,
			temperature_2m_min: 17,
			precipitation_probability_max: prob,
			uv_index_max: null,
			source: 'aemet',
			fetched_at: 'x'
		};
	}

	it('±30 puntos de lluvia marca discrepancia; 29 no', () => {
		expect(compareForecasts(openMeteo, aemetWith(49, 30))).toHaveLength(0);
		const d = compareForecasts(openMeteo, aemetWith(50, 30));
		expect(d).toHaveLength(1);
		expect(d[0]).toMatchObject({ label: 'Probabilidad de lluvia', openMeteo: '20%', aemet: '50%' });
	});

	it('±5 °C de máxima marca discrepancia; 4,9 no', () => {
		expect(compareForecasts(openMeteo, aemetWith(20, 34.9))).toHaveLength(0);
		expect(compareForecasts(openMeteo, aemetWith(20, 35))).toHaveLength(1);
	});

	it('fuentes coherentes → sin discrepancias', () => {
		expect(compareForecasts(openMeteo, aemetWith(25, 31))).toEqual([]);
	});
});
