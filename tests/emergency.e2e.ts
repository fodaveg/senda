import { expect, test } from '@playwright/test';
import { mockPayload } from './mocks';

test('la ficha de emergencia se genera con plan horario, 112 y datos de ajustes', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'senderos-cv:settings',
			JSON.stringify({
				aemetApiKey: '',
				vaultDir: '',
				debugMode: false,
				origin: null,
				emergency: {
					name: 'David',
					phone: '600 000 000',
					medical: 'alergia a las abejas',
					vehicle: 'Coche gris 1234-ABC',
					clothing: 'camiseta naranja',
					alarmMarginMin: 120
				}
			})
		);
	});
	await page.route('https://api.open-meteo.com/**', (route) =>
		route.fulfill({ json: mockPayload() })
	);

	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('link', { name: 'Ficha de emergencia' }).click();
	await expect(page).toHaveURL(/\/emergencia/);

	await expect(page.getByText('HORA LÍMITE DE ALARMA')).toBeVisible();
	await expect(page.getByText(/llama al 112/)).toBeVisible();
	await expect(page.getByText('David', { exact: true })).toBeVisible();
	await expect(page.getByText('alergia a las abejas')).toBeVisible();
	await expect(page.getByText('Coche gris 1234-ABC', { exact: true })).toBeVisible();
	await expect(page.locator('.report').getByText(/VA SOLO\/A/)).toBeVisible();

	// Con acompañantes deja de destacar que va solo.
	await page.getByLabel(/Acompañantes/).fill('Marta');
	await expect(page.locator('.report').getByText(/VA SOLO\/A/)).toHaveCount(0);
	await expect(page.locator('.report').getByText('Marta', { exact: true })).toBeVisible();

	// El texto compacto para mensajería existe y lleva la alarma.
	await page.getByText('Texto compacto para mensajería').click();
	await expect(page.locator('pre')).toContainText('LLAMA AL 112');
});
