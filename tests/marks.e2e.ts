import { expect, test } from '@playwright/test';

test('marcar favorita en la ficha y filtrar por favoritas en el listado', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: /Favorita/ }).click();
	await expect(page.getByRole('button', { name: '★ Favorita' })).toBeVisible();

	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Marcas').selectOption('favorita');
	await expect(page.locator('.route-list li')).toHaveCount(1);
	await expect(page.getByText(/PR-CV 77/)).toBeVisible();
});

test('registrar una salida alimenta el diario y sus estadísticas', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Registrar salida' }).click();
	await page.getByRole('textbox', { name: 'Fecha' }).fill('2026-06-01');
	await page.getByLabel(/Notas/).fill('mañana fresquita');
	await page.getByRole('button', { name: 'Guardar salida' }).click();
	await expect(page.getByRole('button', { name: /Hecha ×1/ })).toBeVisible();

	await page.goto('/diario');
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByText('1 salidas (1 rutas)')).toBeVisible();
	await expect(page.getByText('5.5 km acumulados')).toBeVisible();
	await expect(page.getByText('mañana fresquita')).toBeVisible();
});

test('la copia de seguridad exporta JSON válido del esquema', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: /Me gusta/ }).click();

	await page.goto('/diario');
	await page.locator('body[data-hydrated]').waitFor();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Copia de seguridad (.json)' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/senderos-cv-datos-.*\.json/);
});
