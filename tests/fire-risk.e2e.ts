import { expect, test } from './fixtures';

// PNG 1x1 transparente para simular la imagen del mapa de AEMET.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

// V3 (corrección): con api key, la ficha muestra el riesgo de incendio de
// AEMET (mapa + explicación + nota de prudencia). AEMET solo da mapa regional.
test('la ficha muestra el riesgo de incendio de AEMET con la api key', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'senderos-cv:settings',
			JSON.stringify({ theme: 'auto', aemetApiKey: 'TESTKEY', vaultDir: '', debugMode: false })
		);
	});
	await page.route('**opendata.aemet.es**', (route) => {
		const url = route.request().url();
		if (url.includes('/incendios/')) {
			return route.fulfill({
				json: { estado: 200, datos: 'https://opendata.aemet.es/opendata/sh/fakefire.png' }
			});
		}
		if (url.includes('fakefire.png')) {
			return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
		}
		return route.fulfill({ status: 404, body: '' });
	});

	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();

	const card = page.locator('section.fire-risk');
	await expect(card.getByRole('heading', { name: /Riesgo de incendio/ })).toBeVisible();
	await expect(card.getByText(/se recomienda encarecidamente no hacer la ruta/)).toBeVisible();
	await expect(card.locator('img')).toBeVisible();
});
