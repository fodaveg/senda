import { expect, test } from './fixtures';

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
	// El listado se renderiza de forma incremental (SPECS_V4 §B6), así que el total
	// se lee de la etiqueta de conteo ("N de M rutas"), no contando los <li>.
	const countOf = async () => {
		const text = (await page.locator('p.count').textContent()) ?? '';
		return Number(text.match(/^(\d+)/)?.[1] ?? '0');
	};
	const total = await countOf();
	// El panel "Más filtros" arranca colapsado (variante A del handoff v6).
	await page.getByRole('button', { name: /Más filtros/ }).click();
	await page.getByLabel('Estado').selectOption('homologado');
	const filtered = await countOf();
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
	// "Datos clave" es la etiqueta de la tarjeta del Resumen (rediseño v6).
	await expect(page.getByText('Datos clave', { exact: true })).toBeVisible();
});

test('el corazón de la fila marca la ruta como favorita (handoff v6)', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('pr-cv 77 chulilla');
	const fav = page
		.locator('.route-list li')
		.first()
		.getByRole('button', { name: /favorita/i });
	await fav.click();
	await expect(fav).toHaveAttribute('aria-pressed', 'true');
	// Persiste y el filtro de favoritas la encuentra.
	await page.getByRole('button', { name: /Más filtros/ }).click();
	await page.getByLabel('Marcas').selectOption('favorita');
	await expect(page.locator('.route-list li')).toHaveCount(1);
	await expect(page.getByText(/PR-CV 77/)).toBeVisible();
});

test('la ficha muestra el estado oficial y la nota de reservas', async ({ page }) => {
	// pr-cv-77 está "Sin controles de calidad" → con_reservas.
	await page.goto('/ruta/pr-cv-77');
	// El estado se muestra como badge en la cabecera-tarjeta (rediseño v6), ya no
	// dentro del h1.
	await expect(page.locator('.ficha-head').getByText('Con reservas')).toBeVisible();
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

test('en móvil, el conmutador Lista/Mapa alterna entre las dos vistas', async ({ page }) => {
	// V6-M5: en pantallas pequeñas solo se ve una vista a la vez.
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	// Por defecto, la lista visible y el mapa oculto.
	await expect(page.locator('.route-list')).toBeVisible();
	await expect(page.locator('.map-wrap')).toBeHidden();
	// Cambiar a "Mapa" oculta la lista y muestra el mapa.
	await page.getByRole('button', { name: 'Mapa', exact: true }).click();
	await expect(page.locator('.map-wrap')).toBeVisible();
	await expect(page.locator('.route-list')).toBeHidden();
	// Y volver a "Lista" la restaura.
	await page.getByRole('button', { name: 'Lista', exact: true }).click();
	await expect(page.locator('.route-list')).toBeVisible();
});

test('el enlace de búsqueda en Wikiloc aparece en toda ficha', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	const link = page.getByRole('link', { name: 'Buscar esta ruta en Wikiloc' });
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute('href', /es\.wikiloc\.com\/wikiloc\/find\.do\?q=/);
});

test('un pin del mapa abre la mini-ficha y la X la cierra', async ({ page }) => {
	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('pr-cv 77 chulilla');
	// El mapa reactivo deja un único marcador del resultado filtrado.
	await expect(page.locator('.maplibregl-marker')).toHaveCount(1, { timeout: 10000 });
	await page.locator('.maplibregl-marker').click();
	const card = page.getByLabel('Previsualización de ruta');
	await expect(card).toBeVisible();
	await expect(card.getByText(/PR-CV 77/)).toBeVisible();
	await expect(card.getByText(/fuente\(s\) en ruta/)).toBeVisible();
	await card.getByRole('link', { name: 'Ver ficha →' }).click();
	await expect(page).toHaveURL(/\/ruta\/pr-cv-77/);

	await page.goto('/');
	await page.locator('body[data-hydrated]').waitFor();
	await page.getByLabel('Buscar rutas').fill('pr-cv 77 chulilla');
	await page.locator('.maplibregl-marker').click();
	await page.getByRole('button', { name: 'Cerrar previsualización' }).click();
	await expect(page.getByLabel('Previsualización de ruta')).toHaveCount(0);
});
