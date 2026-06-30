import { expect, test } from './fixtures';

// V3.5-M6: la ficha ofrece el panel "En ruta" (grabación + 112). La grabación
// GPS en sí depende del dispositivo; la lógica está cubierta por tracking.spec.
test('la ficha muestra el panel "En ruta" con grabación y 112', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	const live = page.locator('section.live');
	await expect(live.getByRole('heading', { name: 'En ruta' })).toBeVisible();
	await expect(live.getByRole('button', { name: /Empezar a grabar/ })).toBeVisible();
	await expect(live.getByRole('button', { name: /112/ })).toBeVisible();
});
