import { expect, test } from '@playwright/test';

// V3-M1: el mapa ofrece un selector de capas base (IGN). La lógica pura del
// catálogo y de los extremos del track está cubierta por los tests unitarios
// (layers.spec / track.spec); aquí se comprueba el cableado en la ficha.
test('la ficha ofrece el selector de capas del mapa', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /PR-CV 77/ }).click();
	await expect(page).toHaveURL(/\/ruta\/pr-cv-77/);
	const layerSelect = page.getByLabel('Capa del mapa');
	await expect(layerSelect).toBeVisible();
	await expect(layerSelect.locator('option')).toHaveText([
		'Topográfico',
		'Satélite',
		'Callejero',
		'Relieve'
	]);
});
