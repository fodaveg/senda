import { expect, test } from './fixtures';

test('el pie enlaza la política de privacidad y la página la describe', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	// Enlace en el pie (junto a Créditos).
	await page.locator('footer').getByRole('link', { name: 'Privacidad' }).click();
	await expect(page).toHaveURL(/\/privacidad/);
	await expect(page.getByRole('heading', { name: 'Privacidad y almacenamiento' })).toBeVisible();
	// Puntos clave reales: local-first, analítica opt-in y sin cookies de rastreo.
	await expect(page.getByRole('heading', { name: /Analítica anónima/ })).toBeVisible();
	await expect(page.getByText(/no usa cookies de publicidad ni de seguimiento/)).toBeVisible();
});
