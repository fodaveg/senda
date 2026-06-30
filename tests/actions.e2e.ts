import { expect, test } from './fixtures';

// Acciones v6: exportar la traza FEMECV como GPX (tal cual) y como KML
// (derivado del GeoJSON). Sin servidor: descarga de un blob efímero.
test('exporta la traza como GPX y como KML', async ({ page }) => {
	await page.goto('/ruta/pr-cv-77');
	await page.locator('body[data-hydrated]').waitFor();

	// Los botones se habilitan cuando la traza ya está cargada.
	const gpx = page.getByRole('button', { name: 'GPX' });
	await expect(gpx).toBeEnabled();
	const gpxDownload = page.waitForEvent('download');
	await gpx.click();
	expect((await gpxDownload).suggestedFilename()).toBe('pr-cv-77.gpx');

	const kmlDownload = page.waitForEvent('download');
	await page.getByRole('button', { name: 'KML' }).click();
	const kml = await kmlDownload;
	expect(kml.suggestedFilename()).toBe('pr-cv-77.kml');
});
