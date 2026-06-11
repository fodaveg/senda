import { expect, test } from '@playwright/test';

const CATALOG = 'https://fodaveg.gitlab.io/app-senderismo/catalog';

const NEW_ROUTE = {
	id: 'pr-cv-999',
	name: 'PR-CV 999 Ruta de catálogo nuevo',
	type: 'PR',
	status: 'homologado',
	status_detail: 'En vigor',
	municipality: 'Chulilla',
	zone: 'serranos',
	aemet_municipio: null,
	start: { lat: 39.6, lon: -0.9, name: null },
	distance_km: 5.5,
	ascent_m: 100,
	descent_m: 100,
	circular: true,
	difficulty_mide: null,
	est_duration_min: null,
	water_points: [],
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
	sources: ['e2e']
};

test('buscar actualizaciones descarga, valida y aplica el catálogo nuevo', async ({ page }) => {
	await page.route(`${CATALOG}/manifest.json`, (route) =>
		route.fulfill({
			json: {
				version: 9999,
				published_at: '2026-06-11T12:00:00Z',
				files: { 'routes/pr-cv-999.json': 'sha-a', 'gpx/pr-cv-999.gpx': 'sha-b' }
			}
		})
	);
	await page.route(`${CATALOG}/routes/pr-cv-999.json`, (route) =>
		route.fulfill({ json: NEW_ROUTE })
	);

	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByText(/integrado en la app/)).toBeVisible();
	await page.getByRole('button', { name: 'Buscar actualizaciones de rutas' }).click();
	await expect(page.getByText('Catálogo actualizado: 1 rutas.')).toBeVisible();
	await expect(page.getByText(/v9999/)).toBeVisible();

	// El listado pasa a servirse del catálogo actualizado.
	await page.goto('/');
	await expect(page.getByText('PR-CV 999 Ruta de catálogo nuevo')).toBeVisible();
});

test('un catálogo con una ruta corrupta se rechaza entero', async ({ page }) => {
	await page.route(`${CATALOG}/manifest.json`, (route) =>
		route.fulfill({
			json: {
				version: 9999,
				published_at: '2026-06-11T12:00:00Z',
				files: { 'routes/mala.json': 'sha' }
			}
		})
	);
	await page.route(`${CATALOG}/routes/mala.json`, (route) =>
		route.fulfill({ json: { id: 'mala', name: '' } })
	);

	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Buscar actualizaciones de rutas' }).click();
	await expect(page.getByText(/No se pudo actualizar:.*no valida/)).toBeVisible();
	// El catálogo activo sigue siendo el integrado.
	await expect(page.getByText(/integrado en la app/)).toBeVisible();
});

test('sin red, el botón degrada con un mensaje claro', async ({ page }) => {
	await page.route(`${CATALOG}/**`, (route) => route.abort());
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Buscar actualizaciones de rutas' }).click();
	await expect(page.getByText(/sin conexión o el catálogo aún no está publicado/)).toBeVisible();
});
