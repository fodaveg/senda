import { expect, test } from '@playwright/test';

// V3.5-M3: el usuario marca puntos propios en el mapa de la ficha; persisten.
test('añadir y quitar un waypoint propio en la ficha', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();

	await page.getByRole('button', { name: /Añadir punto propio/ }).click();
	// Clic en el mapa para soltar un punto.
	await page.locator('.map').click({ position: { x: 200, y: 160 } });

	await expect(page.locator('.waypoint-list li')).toHaveCount(1);
	await expect(page.locator('.waypoint-dot')).toHaveCount(1);

	await page.getByRole('button', { name: /Quitar punto/ }).click();
	await expect(page.locator('.waypoint-list li')).toHaveCount(0);
});
