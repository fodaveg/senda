import { expect, test } from '@playwright/test';

// V3-M7 (rediseño): toggle de modo en la barra + galería de esquemas por modo
// en Ajustes, con previsualización y aplicación a toda la app.

test('el toggle de la barra cicla claro→oscuro→auto y persiste', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const toggle = page.getByRole('button', { name: 'Cambiar modo de color' });
	// Por defecto el tema es "auto"; el ciclo lleva auto → claro → oscuro → auto.
	await toggle.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'claro');
	await toggle.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	// Persiste el modo oscuro tras recargar.
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	// Una vuelta más vuelve a "automático" (el modo efectivo lo resuelve el sistema,
	// así que se comprueba por el estado guardado que refleja el título del botón).
	await toggle.click();
	await expect(toggle).toHaveAttribute('title', /autom[áa]tico/);
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
