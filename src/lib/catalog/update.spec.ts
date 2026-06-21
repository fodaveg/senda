import { describe, expect, it } from 'vitest';
import { CatalogError, checkForCatalogUpdate } from './update';
import type { Route } from '$lib/types';

const ROUTE: Route = {
	id: 'pr-cv-999',
	name: 'PR-CV 999 Prueba',
	type: 'PR',
	status: 'homologado',
	status_detail: 'En vigor',
	municipality: 'Chulilla',
	zone: 'serranos',
	aemet_municipio: null,
	start: { lat: 39.6, lon: -0.9, name: null },
	end: null,
	distance_km: 5.5,
	ascent_m: 100,
	descent_m: 100,
	circular: true,
	difficulty_mide: null,
	est_duration_min: null,
	water_points: [],
	water_points_geo: [],
	pois: [],
	escape_routes: [],
	highlights: [],
	best_season: [],
	best_start_time: null,
	shade_ratio: null,
	gpx: 'pr-cv-999.gpx',
	links: { femecv: null, wikiloc: null },
	alternatives: [],
	notes_rain: null,
	bbox: null,
	sources: ['test']
};

function fakeFetch(files: Record<string, { status?: number; body: string }>): typeof fetch {
	return (async (url: string | URL) => {
		const path = String(url).replace('https://catalogo.example/', '');
		const entry = files[path];
		if (!entry) return new Response('no existe', { status: 404 });
		return new Response(entry.body, { status: entry.status ?? 200 });
	}) as unknown as typeof fetch;
}

const BASE = 'https://catalogo.example';

function manifestBody(version: number, files: Record<string, string>): string {
	return JSON.stringify({ version, published_at: '2026-06-11T12:00:00Z', files });
}

describe('checkForCatalogUpdate', () => {
	it('versión nueva: descarga, valida y devuelve rutas ordenadas (sin GPX)', async () => {
		const fetchFn = fakeFetch({
			'manifest.json': {
				body: manifestBody(2, {
					'routes/pr-cv-999.json': 'sha',
					'gpx/pr-cv-999.gpx': 'sha',
					'gear/items.json': 'sha'
				})
			},
			'routes/pr-cv-999.json': { body: JSON.stringify(ROUTE) },
			'gear/items.json': { body: '[]' }
		});
		const update = await checkForCatalogUpdate(
			BASE,
			{ version: 1, published_at: 'x', files: {} },
			fetchFn
		);
		expect(update).not.toBeNull();
		expect(update!.routes.map((r) => r.id)).toEqual(['pr-cv-999']);
		// Los GPX no se descargan en la actualización (se cachean bajo demanda).
		expect(Object.keys(update!.entries)).toEqual(['routes/pr-cv-999.json', 'gear/items.json']);
	});

	it('misma versión o anterior → null (ya al día)', async () => {
		const fetchFn = fakeFetch({ 'manifest.json': { body: manifestBody(2, {}) } });
		expect(
			await checkForCatalogUpdate(BASE, { version: 2, published_at: 'x', files: {} }, fetchFn)
		).toBeNull();
	});

	it('una ruta corrupta rechaza el catálogo entero (sin estados a medias)', async () => {
		const fetchFn = fakeFetch({
			'manifest.json': { body: manifestBody(3, { 'routes/mala.json': 'sha' }) },
			'routes/mala.json': { body: JSON.stringify({ id: 'mala', name: '' }) }
		});
		await expect(checkForCatalogUpdate(BASE, null, fetchFn)).rejects.toBeInstanceOf(CatalogError);
	});

	it('manifest ilegible o ausente → CatalogError', async () => {
		await expect(checkForCatalogUpdate(BASE, null, fakeFetch({}))).rejects.toBeInstanceOf(
			CatalogError
		);
		const fetchFn = fakeFetch({ 'manifest.json': { body: 'no es json' } });
		await expect(checkForCatalogUpdate(BASE, null, fetchFn)).rejects.toBeInstanceOf(CatalogError);
	});

	it('catálogo sin rutas → CatalogError', async () => {
		const fetchFn = fakeFetch({
			'manifest.json': { body: manifestBody(4, { 'gear/items.json': 'sha' }) },
			'gear/items.json': { body: '[]' }
		});
		await expect(checkForCatalogUpdate(BASE, null, fetchFn)).rejects.toBeInstanceOf(CatalogError);
	});
});
