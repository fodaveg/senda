import { expect, test } from '@playwright/test';
import { capXml, hourlyPayload, mockPayload, tarWith } from './mocks';

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

test('el detalle técnico del fallo solo aparece con el modo debug activado', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) => route.abort());

	await page.goto('/ruta/pr-cv-77');
	await expect(page.getByText('Sin conexión o sin pronóstico')).toBeVisible();
	await expect(page.getByText('Detalle técnico')).toHaveCount(0);

	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByRole('checkbox', { name: 'Modo debug' }).check();
	await page.getByRole('button', { name: 'Guardar ajustes' }).click();

	await page.goto('/ruta/pr-cv-77');
	await expect(page.getByText('Sin conexión o sin pronóstico')).toBeVisible();
	await expect(page.getByText(/Detalle técnico/)).toBeVisible();
});

test('la ventana ideal de inicio aparece con el pronóstico del día', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) => {
		const url = route.request().url();
		if (url.includes('hourly=')) return route.fulfill({ json: hourlyPayload() });
		return route.fulfill({ json: mockPayload() });
	});
	await page.goto('/ruta/pr-cv-77');

	// pr-cv-77: 2 h 10 min (MIDE) → cabe de sobra; la franja viene de la luz.
	await expect(page.getByText(/Sal entre las/)).toBeVisible();
	await expect(page.getByText(/terminas antes del anochecer/)).toBeVisible();
});

test('con api key, los avisos CAP vigentes se muestran como banner', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'senderos-cv:settings',
			JSON.stringify({ aemetApiKey: 'KEY-E2E', vaultDir: '', debugMode: false })
		);
	});
	await page.route('https://api.open-meteo.com/**', (route) =>
		route.fulfill({ json: mockPayload() })
	);
	await page.route('https://opendata.aemet.es/opendata/api/avisos_cap/**', (route) =>
		route.fulfill({ json: { estado: 200, datos: 'https://datos-avisos.example/t' } })
	);
	await page.route('https://datos-avisos.example/**', (route) =>
		route.fulfill({ body: tarWith('aviso1.xml', capXml()), contentType: 'application/x-tar' })
	);
	// El pronóstico municipal AEMET responde "sin datos" para no interferir.
	await page.route('https://opendata.aemet.es/opendata/api/prediccion/**', (route) =>
		route.fulfill({ json: { estado: 404, descripcion: 'No hay datos' } })
	);

	await page.goto('/ruta/pr-cv-77');
	await expect(page.getByText('Avisos meteorológicos oficiales (AEMET)')).toBeVisible();
	await expect(page.getByText('Tormentas')).toBeVisible();
	await expect(page.getByText('naranja')).toBeVisible();
});
