import { expect, test } from './fixtures';

test('la página de inicio lista el catálogo completo FEMECV', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Rutas');
	// El catálogo crawleado es grande y cambia con cada re-crawl: se exige
	// orden de magnitud, no número exacto.
	const total = await page.locator('.route-list li').count();
	expect(total).toBeGreaterThan(400);
	await expect(page.getByText(`${total} de ${total} rutas`)).toBeVisible();
});

test('los filtros reducen el listado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const total = await page.locator('.route-list li').count();
	await page.getByLabel('Distancia máx.').selectOption('10');
	await expect(page.getByText(/de \d+ rutas/)).toBeVisible();
	const filtered = await page.locator('.route-list li').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(total);
});

test('el detalle de una ruta muestra los datos técnicos y el perfil', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /PR-CV 77/ }).click();
	await expect(page).toHaveURL(/\/ruta\/pr-cv-77/);
	await expect(page.locator('h1')).toContainText('PR-CV 77');
	// "Datos clave" es la etiqueta de la tarjeta del Resumen (rediseño v6).
	await expect(page.getByText('Datos clave', { exact: true })).toBeVisible();
	await expect(page.getByText('5,5 km').first()).toBeVisible();
	await expect(page.getByRole('figure').first()).toBeVisible();
});
