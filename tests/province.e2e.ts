import { expect, test } from './fixtures';

// V3-M4: filtro por provincia (derivada de la comarca) en el listado.
test('el filtro por provincia reduce el listado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const total = await page.locator('.route-list li').count();
	await page.getByLabel('Provincia').selectOption('castellon');
	await expect(page.getByText(/de \d+ rutas/)).toBeVisible();
	const filtered = await page.locator('.route-list li').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(total);
});
