import { expect, test } from '@playwright/test';

// V3-M7: toggle de tema en la barra superior y paletas de color en Ajustes.

test('el toggle de la barra cambia a oscuro y persiste', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	// Persiste tras recargar y el botón ahora ofrece volver a claro.
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	await expect(page.getByRole('button', { name: 'Cambiar a modo claro' })).toBeVisible();
});

test('la paleta de color elegida en Ajustes se aplica y persiste', async ({ page }) => {
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Paleta de color').selectOption('mar');
	// applyPalette fija el token de acento con el color de la paleta "Mar".
	const brand = await page.evaluate(() =>
		document.documentElement.style.getPropertyValue('--brand')
	);
	expect(brand).toContain('#1b4965');
	await page.getByRole('button', { name: 'Guardar ajustes' }).click();
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByLabel('Paleta de color')).toHaveValue('mar');
});
