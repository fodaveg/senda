import { expect, test } from '@playwright/test';

test('la página de inicio lista las rutas reales', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Rutas');
	await expect(page.locator('.route-list li')).toHaveCount(5);
	await expect(page.getByText('5 de 5 rutas')).toBeVisible();
});

test('los filtros reducen el listado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Distancia máx.').selectOption('10');
	await expect(page.locator('.route-list li')).toHaveCount(2);
});

test('el detalle de una ruta muestra los datos técnicos y el perfil', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /PR-CV 77/ }).click();
	await expect(page).toHaveURL(/\/ruta\/pr-cv-77/);
	await expect(page.locator('h1')).toContainText('PR-CV 77');
	await expect(page.getByRole('heading', { name: 'Datos técnicos' })).toBeVisible();
	await expect(page.getByText('5,5 km').first()).toBeVisible();
	await expect(page.getByRole('figure')).toBeVisible();
});
