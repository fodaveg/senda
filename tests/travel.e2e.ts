import { expect, test } from '@playwright/test';

// V3-M4: el enlace de indicaciones a OpenStreetMap debe llevar el origen
// (habitual o GPS) además del destino, para no tener que rellenarlo a mano.
test('con origen habitual, las indicaciones OSM incluyen from y to', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'senderos-cv:settings',
			JSON.stringify({
				aemetApiKey: '',
				vaultDir: '',
				debugMode: false,
				origin: { lat: 39.65, lon: -0.89, label: 'Casa rural' }
			})
		);
	});
	await page.goto('/ruta/pr-cv-77');
	const link = page.getByRole('link', { name: 'Indicaciones en OpenStreetMap' });
	await expect(link).toHaveAttribute('href', /[?&]from=39\.65%2C-0\.89/);
	await expect(link).toHaveAttribute('href', /[?&]to=/);
});

// Sin origen configurado, el enlace mantiene el comportamiento previo (solo destino).
test('sin origen, las indicaciones OSM llevan solo el destino', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	const link = page.getByRole('link', { name: 'Indicaciones en OpenStreetMap' });
	await expect(link).toHaveAttribute('href', /directions\?to=/);
	await expect(link).not.toHaveAttribute('href', /from=/);
});
