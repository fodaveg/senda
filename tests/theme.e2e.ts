import { expect, test } from '@playwright/test';

// V3-M7 (rediseño): toggle de modo en la barra + galería de esquemas por modo
// en Ajustes, con previsualización y aplicación a toda la app.

test('el toggle de la barra cambia a oscuro y persiste', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	await expect(page.getByRole('button', { name: 'Cambiar a modo claro' })).toBeVisible();
});

test('elegir un esquema de modo oscuro lo aplica a toda la app y persiste', async ({ page }) => {
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();

	// Activar modo oscuro y elegir el esquema "Noche azul".
	await page.getByLabel('Tema').selectOption('oscuro');
	await page.getByRole('radio', { name: 'Noche azul' }).click();

	const bg = () =>
		page.evaluate(() => document.documentElement.style.getPropertyValue('--bg').trim());
	expect(await bg()).toBe('#0f1722');

	await page.getByRole('button', { name: 'Guardar ajustes' }).click();
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByRole('radio', { name: 'Noche azul' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	expect(await bg()).toBe('#0f1722');
});
