import { describe, expect, it } from 'vitest';
import {
	AemetAuthError,
	AemetRateLimitError,
	compareForecasts,
	fetchAemetForecast,
	fetchAemetForecastCached,
	normalizeAemet,
	validateAemetKey,
	type AemetDay
} from './aemet';
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
				JSON.stringify({ estado: 404, descripcion: 'No hay datos que satisfagan esos criterios' })
			)) as unknown as typeof fetch;
		await expect(fetchAemetForecast('46112', 'KEY', fakeFetch)).rejects.toThrow(/No hay datos/);
	});

	it('key rechazada (401 en el sobre) → AemetAuthError, distinguible de un fallo de red', async () => {
		const fakeFetch = (async () =>
			new Response(
				JSON.stringify({ estado: 401, descripcion: 'api key invalida' })
			)) as unknown as typeof fetch;
		await expect(fetchAemetForecast('46112', 'MALA', fakeFetch)).rejects.toBeInstanceOf(
			AemetAuthError
		);
	});

	it('key rechazada (HTTP 401) → AemetAuthError', async () => {
		const fakeFetch = (async () =>
			new Response('denegado', { status: 401 })) as unknown as typeof fetch;
		await expect(fetchAemetForecast('46112', 'MALA', fakeFetch)).rejects.toBeInstanceOf(
			AemetAuthError
		);
	});
});

describe('validateAemetKey', () => {
	it('sobre con estado 200 y URL de datos → valid', async () => {
		const fakeFetch = (async () =>
			new Response(
				JSON.stringify({ estado: 200, datos: 'https://datos.example/x' })
			)) as unknown as typeof fetch;
		expect(await validateAemetKey('KEY', fakeFetch)).toBe('valid');
	});

	it('HTTP 401 o estado 401 en el cuerpo → invalid', async () => {
		const http401 = (async () =>
			new Response('denegado', { status: 401 })) as unknown as typeof fetch;
		expect(await validateAemetKey('MALA', http401)).toBe('invalid');

		const body401 = (async () =>
			new Response(
				JSON.stringify({ estado: 401, descripcion: 'api key invalida' })
			)) as unknown as typeof fetch;
		expect(await validateAemetKey('MALA', body401)).toBe('invalid');
	});

	it('sin red o API caída → unreachable, nunca invalid', async () => {
		const offline = (async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof fetch;
		expect(await validateAemetKey('KEY', offline)).toBe('unreachable');

		const error500 = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
		expect(await validateAemetKey('KEY', error500)).toBe('unreachable');
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

describe('fetchAemetForecastCached', () => {
	function fakeStore(initial: Record<string, string> = {}) {
		const data = new Map(Object.entries(initial));
		return {
			getItem: (k: string) => data.get(k) ?? null,
			setItem: (k: string, v: string) => void data.set(k, v),
			dump: () => data
		};
	}

	function countingFetch() {
		const state = { calls: 0 };
		const fetchFn = (async (url: string | URL) => {
			state.calls++;
			if (String(url).includes('opendata.aemet.es')) {
				return new Response(JSON.stringify({ estado: 200, datos: 'https://datos.example/x' }));
			}
			return new Response(JSON.stringify(AEMET_DATA));
		}) as unknown as typeof fetch;
		return { fetchFn, state };
	}

	it('cachea por municipio: la segunda llamada dentro del TTL no toca la red', async () => {
		const storage = fakeStore();
		const { fetchFn, state } = countingFetch();
		const first = await fetchAemetForecastCached('46112', 'KEY', {
			fetchFn,
			storage,
			now: () => 0
		});
		expect(state.calls).toBe(2); // sobre + datos
		const second = await fetchAemetForecastCached('46112', 'KEY', {
			fetchFn,
			storage,
			now: () => 59 * 60 * 1000
		});
		expect(state.calls).toBe(2);
		expect(second).toEqual(first);
	});

	it('caché caducada (>1 h) → vuelve a consultar', async () => {
		const storage = fakeStore();
		const { fetchFn, state } = countingFetch();
		await fetchAemetForecastCached('46112', 'KEY', { fetchFn, storage, now: () => 0 });
		await fetchAemetForecastCached('46112', 'KEY', {
			fetchFn,
			storage,
			now: () => 61 * 60 * 1000
		});
		expect(state.calls).toBe(4);
	});

	it('caché corrupta → se ignora y se consulta', async () => {
		const storage = fakeStore({ 'senderos-cv:aemet:46112': 'no-es-json{' });
		const { fetchFn, state } = countingFetch();
		const days = await fetchAemetForecastCached('46112', 'KEY', { fetchFn, storage });
		expect(state.calls).toBe(2);
		expect(days).toHaveLength(1);
	});

	it('los errores no se cachean: se propagan frescos', async () => {
		const storage = fakeStore();
		const fail429 = (async () => new Response('limit', { status: 429 })) as unknown as typeof fetch;
		await expect(
			fetchAemetForecastCached('46112', 'KEY', { fetchFn: fail429, storage })
		).rejects.toBeInstanceOf(AemetRateLimitError);
		expect(storage.dump().size).toBe(0);
	});
});

describe('AemetRateLimitError (429)', () => {
	it('HTTP 429 → AemetRateLimitError', async () => {
		const fakeFetch = (async () =>
			new Response('limit', { status: 429 })) as unknown as typeof fetch;
		await expect(fetchAemetForecast('46112', 'KEY', fakeFetch)).rejects.toBeInstanceOf(
			AemetRateLimitError
		);
	});

	it('estado 429 dentro de un 200 → AemetRateLimitError', async () => {
		const fakeFetch = (async () =>
			new Response(
				JSON.stringify({ estado: 429, descripcion: 'límite alcanzado' })
			)) as unknown as typeof fetch;
		await expect(fetchAemetForecast('46112', 'KEY', fakeFetch)).rejects.toBeInstanceOf(
			AemetRateLimitError
		);
	});
});
