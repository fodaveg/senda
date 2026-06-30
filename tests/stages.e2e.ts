import { expect, test } from './fixtures';

// V3-M3: una GR multi-día muestra sus etapas y "Ver Etapas" enlaza a ellas;
// una etapa enlaza de vuelta a su ruta padre.
test('la ruta padre lista sus etapas y enlaza desde el estado', async ({ page }) => {
	await page.goto('/ruta/gr-10');
	await page.locator('body[data-hydrated]').waitFor();

	const section = page.locator('#etapas');
	await expect(section.getByRole('heading', { name: /Etapas/ })).toBeVisible();
	await expect(section.getByRole('link').first()).toBeVisible();

	// El estado "Ver Etapas" es un enlace a la sección.
	const estadoLink = page.getByRole('link', { name: 'Ver Etapas' });
	await expect(estadoLink).toHaveAttribute('href', '#etapas');
});

test('una etapa enlaza de vuelta a su ruta padre', async ({ page }) => {
	await page.goto('/ruta/gr-10-e01');
	await page.locator('body[data-hydrated]').waitFor();
	const back = page.getByText('Esta ruta es una etapa de');
	await expect(back).toBeVisible();
	await expect(back.getByRole('link')).toHaveAttribute('href', /\/ruta\/gr-10$/);
});
