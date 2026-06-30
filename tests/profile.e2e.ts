import { expect, test } from './fixtures';

// V3-M5: el perfil de elevación muestra un tooltip legible (caja de contraste
// fijo) al recorrerlo con el ratón, y sincroniza el marcador del mapa.
test('el perfil de elevación muestra el tooltip al hacer hover', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /PR-CV 77/ }).click();
	await expect(page).toHaveURL(/\/ruta\/pr-cv-77/);
	const svg = page.locator('figure.profile svg');
	await expect(svg).toBeVisible();
	await svg.hover({ position: { x: 300, y: 100 } });
	const tooltip = page.getByTestId('profile-tooltip');
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(/km [\d,.]+ · \d+ m/);
});
