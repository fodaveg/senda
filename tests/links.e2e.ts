import { expect, test } from '@playwright/test';

// V3.5-M5: "rutas que enlazan" (por proximidad de extremos) en la ficha.
test('la ficha muestra rutas que enlazan', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	const section = page.locator('section', { hasText: 'Enlaza con' });
	await expect(section.getByRole('heading', { name: /Enlaza con/ })).toBeVisible();
	await expect(section.getByRole('link').first()).toBeVisible();
});
