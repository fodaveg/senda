import { expect, test } from '@playwright/test';

// V3-M6: el usuario añade material custom en la ficha; persiste y se puede
// quitar. La evaluación de avisos (warn) está cubierta por los unit tests.
test('añadir y quitar material custom en la ficha', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();

	const section = page.locator('.custom-gear');
	await expect(section.getByRole('heading', { name: /Tu material/ })).toBeVisible();

	await section.getByLabel('Nombre').fill('Calcetines impermeables');
	await section.getByLabel('Abrigo').check();
	await section.getByRole('button', { name: 'Añadir a mi material' }).click();

	await expect(section.getByText('Calcetines impermeables')).toBeVisible();

	// Persiste tras recargar.
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.locator('.custom-gear').getByText('Calcetines impermeables')).toBeVisible();

	// Se puede quitar.
	await page.getByRole('button', { name: 'Quitar Calcetines impermeables' }).click();
	await expect(page.locator('.custom-gear').getByText('Calcetines impermeables')).toHaveCount(0);
});
