/**
 * Tracks GPX como texto, cargados perezosamente: el detalle de una ruta
 * solo descarga su propio track.
 */

const modules = import.meta.glob('../../../data/gpx/*.gpx', {
	query: '?raw',
	import: 'default'
});

export async function loadTrackXml(gpxFile: string): Promise<string> {
	const key = `../../../data/gpx/${gpxFile}`;
	const loader = modules[key];
	if (!loader) throw new Error(`No existe el track ${gpxFile} en data/gpx/`);
	return (await loader()) as string;
}
