import { expect, test } from '@playwright/test';

test('la página de inicio muestra el título de la app', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Senderos CV');
});
