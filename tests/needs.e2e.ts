import { expect, test } from './fixtures';

// V3.5-M1: la mochila muestra agua y energía estimadas (etiquetadas como tal).
test('la ficha muestra agua y energía estimadas', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	const needs = page.locator('.needs');
	await expect(needs.getByRole('heading', { name: 'Agua y energía' })).toBeVisible();
	await expect(needs.getByText(/kcal/).first()).toBeVisible();
	await expect(needs.getByText(/estimación/).first()).toBeVisible();
});
