import { describe, expect, it } from 'vitest';
import { AemetAuthError, AemetRateLimitError } from './aemet';
import { fetchFireRiskMap, fireRiskUrl, FIRE_RISK_MAX_DAY } from './fireRisk';

function jsonResponse(body: unknown, status = 200): Response {
	return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('fireRiskUrl', () => {
	it('hoy (offset 0) usa el mapa estimado', () => {
		expect(fireRiskUrl(0)).toContain('/incendios/mapasriesgo/estimado/area/p');
	});
	it('días futuros usan el mapa previsto del día', () => {
		expect(fireRiskUrl(2)).toContain('/incendios/mapasriesgo/previsto/dia/2/area/p');
	});
});

describe('fetchFireRiskMap', () => {
	it('devuelve la URL de la imagen del sobre AEMET', async () => {
		const fetchFn = (async () =>
			jsonResponse({
				estado: 200,
				datos: 'https://opendata.aemet.es/opendata/sh/x.png'
			})) as typeof fetch;
		expect(await fetchFireRiskMap('KEY', 0, 'p', fetchFn)).toBe(
			'https://opendata.aemet.es/opendata/sh/x.png'
		);
	});

	it('día fuera de rango → null sin pedir nada', async () => {
		let called = false;
		const fetchFn = (async () => {
			called = true;
			return jsonResponse({});
		}) as typeof fetch;
		expect(await fetchFireRiskMap('KEY', FIRE_RISK_MAX_DAY + 1, 'p', fetchFn)).toBeNull();
		expect(called).toBe(false);
	});

	it('estado 404 → null (sin mapa, no es error)', async () => {
		const fetchFn = (async () =>
			jsonResponse({ estado: 404, descripcion: 'no data' })) as typeof fetch;
		expect(await fetchFireRiskMap('KEY', 1, 'p', fetchFn)).toBeNull();
	});

	it('401 → AemetAuthError; 429 → AemetRateLimitError', async () => {
		const auth = (async () => jsonResponse({}, 401)) as typeof fetch;
		await expect(fetchFireRiskMap('KEY', 0, 'p', auth)).rejects.toBeInstanceOf(AemetAuthError);
		const rate = (async () => jsonResponse({}, 429)) as typeof fetch;
		await expect(fetchFireRiskMap('KEY', 0, 'p', rate)).rejects.toBeInstanceOf(AemetRateLimitError);
	});
});
