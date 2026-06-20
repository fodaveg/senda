import { expect, test } from '@playwright/test';

// V3-M6 (rediseño): el material propio se gestiona en Ajustes y aparece
// integrado en la lista de la mochila de cada ruta. La evaluación de avisos
// (warn) está cubierta por los unit tests.
test('añadir material en Ajustes y verlo en la mochila de una ruta', async ({ page }) => {
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();

	const gear = page.locator('fieldset', { hasText: 'Mi material' });
	await gear.getByLabel('Nombre').fill('Calcetines impermeables');
	await gear.getByText('Abrigo', { exact: true }).click();
	await gear.getByRole('button', { name: 'Añadir material' }).click();
	await expect(gear.getByText('Calcetines impermeables')).toBeVisible();

	// Aparece en la mochila de la ficha, en la sección "Tu material".
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	const tuMaterial = page.locator('section', { hasText: 'Tu material' });
	await expect(tuMaterial.getByText('Calcetines impermeables')).toBeVisible();

	// Se puede quitar desde Ajustes.
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Quitar Calcetines impermeables' }).click();
	await expect(
		page.locator('fieldset', { hasText: 'Mi material' }).getByText('Calcetines impermeables')
	).toHaveCount(0);
});
