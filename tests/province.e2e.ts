import { expect, test } from './fixtures';

// V3-M4: filtro por provincia (derivada de la comarca) en el listado.
test('el filtro por provincia reduce el listado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const total = await page.locator('.route-list li').count();
	// El panel "Más filtros" arranca colapsado (variante A del handoff v6).
	await page.getByRole('button', { name: /Más filtros/ }).click();
	// `getByLabel('Provincia')` colisiona con el aria-label del corazón ♡ en rutas
	// cuyo nombre contiene "PROVINCIAL"; el combobox lo acota al <select>.
	await page.getByRole('combobox', { name: 'Provincia' }).selectOption('castellon');
	await expect(page.getByText(/de \d+ rutas/)).toBeVisible();
	const filtered = await page.locator('.route-list li').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(total);
});
