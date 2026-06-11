import { expect, test } from '@playwright/test';

test('el buscador filtra por municipio sin acentos', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('chulilla');
	await expect(page.getByText(/PR-CV 77/)).toBeVisible();
	const count = await page.locator('.route-list li').count();
	expect(count).toBeLessThan(20);
	expect(count).toBeGreaterThan(0);
});

test('el filtro de estado muestra solo homologadas y el badge se ve', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	const total = await page.locator('.route-list li').count();
	await page.getByLabel('Estado').selectOption('homologado');
	const filtered = await page.locator('.route-list li').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(total);
	await expect(page.locator('.route-list li').first().getByText('Homologada')).toBeVisible();
});

test('el dado abre una ruta del resultado filtrado', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('chulilla');
	await page.locator('.route-list li').first().waitFor();
	await page.getByRole('button', { name: 'Ruta al azar' }).click();
	await expect(page).toHaveURL(/\/ruta\/[a-z0-9-]+/);
	await expect(page.getByRole('heading', { name: 'Datos técnicos' })).toBeVisible();
});

test('la ficha muestra el estado oficial y la nota de reservas', async ({ page }) => {
	// pr-cv-77 está "Sin controles de calidad" → con_reservas.
	await page.goto('/ruta/pr-cv-77');
	await expect(page.locator('h1').getByText('Con reservas')).toBeVisible();
	await expect(page.getByText(/Sin control de calidad reciente/)).toBeVisible();
	await expect(page.getByText('Sin controles de calidad', { exact: true }).first()).toBeVisible();
});

test('con origen habitual, la ficha estima el viaje y el listado ordena por cercanía', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem(
			'senderos-cv:settings',
			JSON.stringify({
				aemetApiKey: '',
				vaultDir: '',
				debugMode: false,
				// Chulilla: el inicio de PR-CV 77 queda a tiro de piedra.
				origin: { lat: 39.65, lon: -0.89, label: 'Casa rural' }
			})
		);
	});
	await page.route('https://router.project-osrm.org/**', (route) =>
		route.fulfill({ json: { code: 'Ok', routes: [{ duration: 3912, distance: 78250 }] } })
	);

	await page.goto('/ruta/pr-cv-77');
	await expect(page.getByText(/En coche desde Casa rural/)).toBeVisible();
	await expect(page.getByText(/1 h 5 min/)).toBeVisible();
	await expect(page.getByText(/estimación OSRM/)).toBeVisible();

	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Ordenar').selectOption('cercania');
	await expect(
		page
			.locator('.route-list li')
			.first()
			.getByText(/PR-CV 77/)
	).toBeVisible();
});

test('tema oscuro y claro forzado se aplican desde ajustes', async ({ page }) => {
	await page.goto('/ajustes');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Tema').selectOption('oscuro');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
	await page.getByRole('button', { name: 'Guardar ajustes' }).click();
	// Persiste tras recargar.
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'oscuro');
});

test('el enlace de búsqueda en Wikiloc aparece en toda ficha', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	const link = page.getByRole('link', { name: 'Buscar esta ruta en Wikiloc' });
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute('href', /es\.wikiloc\.com\/wikiloc\/find\.do\?q=/);
});
