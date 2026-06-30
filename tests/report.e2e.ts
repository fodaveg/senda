import { expect, test } from './fixtures';
import { mockPayload } from './mocks';

test('el informe se genera desde el detalle y permite descargar el .md', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) =>
		route.fulfill({ json: mockPayload() })
	);
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();
	// La acción está en la cabecera (primera) y, repetida, en la sección Acciones.
	await page.getByRole('link', { name: 'Generar informe' }).first().click();

	await expect(page).toHaveURL(/\/ruta\/pr-cv-77\/informe\?fecha=\d{4}-\d{2}-\d{2}/);
	await expect(page.locator('article h1')).toContainText('PR-CV 77');
	await expect(page.getByRole('heading', { name: 'Mochila recomendada' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Fauna y seguridad en la zona' })).toBeVisible();
	await expect(page.getByText(/Fuente: Open-Meteo, consultado/)).toBeVisible();
	await expect(page.getByText('Poncho / chubasquero — Probabilidad de lluvia 80%')).toBeVisible();

	// Sin Tauri no hay "Guardar como…".
	await expect(page.getByRole('button', { name: 'Guardar como…' })).toHaveCount(0);

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Descargar .md' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/^informe-pr-cv-77-\d{4}-\d{2}-\d{2}\.md$/);
});

test('sin conexión, el informe lo dice y no inventa meteo', async ({ page }) => {
	await page.route('https://api.open-meteo.com/**', (route) => route.abort());
	await page.goto('/ruta/pr-cv-77/informe');
	await expect(page.getByText('Sin pronóstico disponible al generar el informe')).toBeVisible();
	await expect(page.getByText('A tu criterio', { exact: false }).first()).toBeVisible();
});
