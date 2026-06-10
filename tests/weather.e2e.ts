import { expect, test } from '@playwright/test';

function isoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Pronóstico mockeado: 8 días desde hoy con lluvia 80%, UV 8 y 30 °C. */
function mockPayload() {
	const days = Array.from({ length: 8 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() + i);
		return isoDate(d);
	});
	const fill = (v: unknown) => days.map(() => v);
	return {
		daily: {
			time: days,
			temperature_2m_max: fill(30),
			temperature_2m_min: fill(18),
			precipitation_probability_max: fill(80),
			precipitation_sum: fill(6.5),
			uv_index_max: fill(8),
			wind_speed_10m_max: fill(20),
			sunrise: days.map((d) => `${d}T06:35`),
			sunset: days.map((d) => `${d}T21:25`)
		}
	};
}

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
