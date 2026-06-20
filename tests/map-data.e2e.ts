import { expect, test } from '@playwright/test';

// V3-M2: fuentes de agua y POIs se pintan en el mapa con toggles (visibles por
// defecto). gr-10-e01 tiene fuentes y POIs derivados de OSM.
test('el mapa pinta fuentes y POIs con toggles que las ocultan', async ({ page }) => {
	await page.goto('/ruta/gr-10-e01');
	await page.locator('body[data-hydrated]').waitFor();

	// Marcadores visibles por defecto.
	await expect(page.locator('.water-dot').first()).toBeVisible();
	await expect(page.locator('.poi-dot').first()).toBeVisible();
	const waterCount = await page.locator('.water-dot').count();
	expect(waterCount).toBeGreaterThan(0);

	// El toggle de fuentes las oculta.
	await page.getByText(/Fuentes \(\d+\)/).click();
	await expect(page.locator('.water-dot')).toHaveCount(0);
	// Los POIs siguen visibles (toggle independiente).
	await expect(page.locator('.poi-dot').first()).toBeVisible();
});

test('al pasar el ratón sobre un POI aparece su ventana flotante', async ({ page }) => {
	await page.goto('/ruta/gr-10-e01');
	await page.locator('body[data-hydrated]').waitFor();
	await page.locator('.poi-dot').first().hover();
	await expect(page.locator('.maplibregl-popup')).toBeVisible();
});
