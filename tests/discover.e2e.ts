import { expect, test } from '@playwright/test';

test('el buscador filtra por municipio sin acentos', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('chulilla');
	await expect(page.getByText(/PR-CV 77/)).toBeVisible();
	const count = await page.locator('.route-list li').count();
	expect(count).toBeLessThan(20);
	expect(count).toBeGreaterThan(0);
});

test('el filtro de estado muestra solo homologadas y el badge se ve', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const total = await page.locator('.route-list li').count();
	await page.getByLabel('Estado').selectOption('homologado');
	const filtered = await page.locator('.route-list li').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(total);
	await expect(page.locator('.route-list li').first().getByText('Homologada')).toBeVisible();
});

test('el dado abre una ruta del resultado filtrado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('chulilla');
	await page.locator('.route-list li').first().waitFor();
	await page.getByRole('button', { name: 'Ruta al azar' }).click();
	await expect(page).toHaveURL(/\/ruta\/[a-z0-9-]+/);
	await expect(page.getByRole('heading', { name: 'Datos técnicos' })).toBeVisible();
});

test('la ficha muestra el estado oficial y la nota de reservas', async ({ page }) => {
	// pr-cv-77 está "Sin controles de calidad" → con_reservas.
	await page.goto('/ruta/pr-cv-77');
	await expect(page.locator('h1').getByText('Con reservas')).toBeVisible();
	await expect(page.getByText(/Sin control de calidad reciente/)).toBeVisible();
	await expect(
		page.getByText('Sin controles de calidad', { exact: true }).first()
	).toBeVisible();
});
