import { expect, test } from './fixtures';

// V3.5-M5: filtros "apto para" en el listado (exigen el dato conocido).
test('el filtro "Con agua" reduce el listado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const total = await page.locator('.route-list li').count();
	await page.getByText('Con agua', { exact: true }).click();
	await expect(page.getByText(/de \d+ rutas/)).toBeVisible();
	const filtered = await page.locator('.route-list li').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(total);
});
