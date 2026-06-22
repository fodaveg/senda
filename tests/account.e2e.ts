import { expect, test } from '@playwright/test';

// V4-M3: flujo de cuentas con backend SIMULADO (SPECS_V4 §A7). Se interceptan
// los endpoints de GoTrue (`/auth/v1/**`) con page.route para no tocar el
// backend real ni crear usuarios; se valida que el adaptador + store + UI
// reaccionan correctamente.

/** Sesión con la forma que devuelve GoTrue en el grant de contraseña. */
const SESSION = {
	access_token: 'e2e-access',
	token_type: 'bearer',
	expires_in: 3600,
	expires_at: 9999999999,
	refresh_token: 'e2e-refresh',
	user: { id: 'u-e2e', email: 'monta@senda.dev', aud: 'authenticated', role: 'authenticated' }
};

test('login con backend simulado: entra y muestra el backoffice', async ({ page }) => {
	await page.route('**/auth/v1/**', (route) => {
		const url = route.request().url();
		if (url.includes('/token')) return route.fulfill({ json: SESSION });
		return route.fulfill({ json: SESSION.user });
	});
	// Tras el login, el repositorio conmuta a sincronizado (§B2) y consulta las
	// tablas; se simula el REST de datos para no tocar el backend real.
	await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));

	await page.goto('/cuenta');
	await page.locator('body[data-hydrated]').waitFor();

	await page.getByLabel('Email').fill('monta@senda.dev');
	await page.getByLabel('Contraseña', { exact: true }).fill('senda1234');
	await page.getByRole('button', { name: 'Entrar' }).click();

	// Backoffice visible con el email y la opción de cerrar sesión.
	await expect(page.getByText('monta@senda.dev')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
	// La cabecera pasa a "Cuenta".
	await expect(page.getByRole('link', { name: 'Cuenta' })).toBeVisible();
});

test('credenciales inválidas muestran un error en español', async ({ page }) => {
	await page.route('**/auth/v1/**', (route) => {
		const url = route.request().url();
		if (url.includes('/token')) {
			return route.fulfill({
				status: 400,
				json: {
					error: 'invalid_grant',
					error_description: 'Invalid login credentials',
					msg: 'Invalid login credentials'
				}
			});
		}
		return route.fulfill({ json: {} });
	});

	await page.goto('/cuenta');
	await page.locator('body[data-hydrated]').waitFor();

	await page.getByLabel('Email').fill('x@y.dev');
	await page.getByLabel('Contraseña', { exact: true }).fill('malísima');
	await page.getByRole('button', { name: 'Entrar' }).click();

	await expect(page.getByRole('alert')).toContainText('incorrectos');
});
