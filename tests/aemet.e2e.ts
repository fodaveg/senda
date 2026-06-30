import { expect, test } from './fixtures';
import { aemetPayload, mockPayload } from './mocks';

const DATOS_URL = 'https://aemet-datos.example/prediccion';

async function saveKeyInSettings(page: import('@playwright/test').Page, key: string) {
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.locator('input[type="password"]').fill(key);
	await page.getByRole('button', { name: 'Guardar ajustes' }).click();
}

test('la key guardada en ajustes se valida y la ruta empieza a usarla', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) =>
		route.fulfill({ json: mockPayload() })
	);
	await page.route('https://opendata.aemet.es/**', (route) =>
		route.fulfill({ json: { estado: 200, datos: DATOS_URL } })
	);
	await page.route(`${DATOS_URL}*`, (route) => route.fulfill({ json: aemetPayload() }));

	await saveKeyInSettings(page, 'KEY-E2E-VALIDA');
	await expect(page.getByText('✓ API key válida', { exact: false })).toBeVisible();

	await page.goto('/ruta/pr-cv-77');
	await expect(page.locator('.weather').getByText(/Verificación AEMET/)).toBeVisible();
	await expect(page.locator('.weather').getByText('75%')).toBeVisible();
});

test('key rechazada: aviso al guardar y nota en la ruta, sin romper la meteo primaria', async ({
	page
}) => {
	await page.route('https://api.open-meteo.com/**', (route) =>
		route.fulfill({ json: mockPayload() })
	);
	await page.route('https://opendata.aemet.es/**', (route) =>
		route.fulfill({ status: 401, json: { estado: 401, descripcion: 'api key invalida' } })
	);

	await saveKeyInSettings(page, 'KEY-MALA');
	await expect(page.getByText('AEMET rechazó la api key', { exact: false })).toBeVisible();

	await page.goto('/ruta/pr-cv-77');
	// Open-Meteo sigue funcionando y la nota explica por qué no hay verificación.
	await expect(page.locator('.weather').getByText(/Open-Meteo/)).toBeVisible();
	await expect(page.locator('.weather').getByText(/AEMET rechazó la api key/)).toBeVisible();
});
