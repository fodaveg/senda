import { expect, test } from '@playwright/test';
import { mockPayload } from './mocks';

test('con pronóstico de lluvia, el poncho se habilita con su razón', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) =>
		route.fulfill({ json: mockPayload() })
	);
	await page.goto('/ruta/pr-cv-77');

	await expect(page.locator('.weather').getByText('80%')).toBeVisible();
	await expect(page.locator('.weather').getByText(/Open-Meteo/)).toBeVisible();
	await expect(page.locator('.date-picker .date-chip')).toHaveCount(8);

	const llevar = page.locator('.backpack section').first();
	await expect(llevar.getByText('Poncho / chubasquero')).toBeVisible();
	await expect(llevar.getByText('Probabilidad de lluvia 80%')).toBeVisible();
	await expect(llevar.getByText('Crema solar')).toBeVisible();
	await expect(llevar.getByText('UV 8: reaplicar cada 2 h')).toBeVisible();
	await expect(llevar.getByText('Calor y sin fuentes en ruta')).toBeVisible();
});

test('sin conexión: panel meteo vacío y reglas meteo en indeterminado', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) => route.abort());
	await page.goto('/ruta/pr-cv-77');

	await expect(page.getByText('Sin conexión o sin pronóstico')).toBeVisible();

	// El equipo base sigue recomendado.
	const llevar = page.locator('.backpack section').first();
	await expect(llevar.getByText('Botiquín')).toBeVisible();

	// Lo que depende de la meteo queda a criterio del usuario, nunca descartado.
	const dudosos = page.locator('.backpack section', { hasText: 'A tu criterio' });
	await expect(dudosos.getByText('Poncho / chubasquero')).toBeVisible();
	await expect(dudosos.getByText(/Sin datos suficientes/).first()).toBeVisible();
});
