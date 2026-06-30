import { describe, expect, it } from 'vitest';
import { geojsonToKml } from './kml';
import type { FeatureCollection } from 'geojson';

function lineString(coords: number[][]): FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: [
			{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
		]
	};
}

describe('geojsonToKml', () => {
	it('emite un KML con la línea y las coordenadas lon,lat[,ele]', () => {
		const kml = geojsonToKml(
			lineString([
				[-0.5, 39.6, 120],
				[-0.51, 39.61]
			]),
			'PR-CV 77'
		);
		expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
		expect(kml).toContain('<coordinates>-0.5,39.6,120 -0.51,39.61</coordinates>');
		expect(kml).toContain('<name>PR-CV 77</name>');
	});

	it('aplana varias líneas (MultiLineString incluido)', () => {
		const fc: FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: { type: 'LineString', coordinates: [[0, 0]] }
				},
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'MultiLineString',
						coordinates: [
							[
								[1, 1],
								[2, 2]
							]
						]
					}
				}
			]
		};
		expect(geojsonToKml(fc, 'x')).toContain('<coordinates>0,0 1,1 2,2</coordinates>');
	});

	it('escapa caracteres XML del nombre', () => {
		const kml = geojsonToKml(lineString([[0, 0]]), 'Ruta <A> & "B"');
		expect(kml).toContain('Ruta &lt;A&gt; &amp; &quot;B&quot;');
		expect(kml).not.toContain('<A>');
	});

	it('traza vacía → KML válido con coordenadas vacías', () => {
		const kml = geojsonToKml({ type: 'FeatureCollection', features: [] }, 'vacía');
		expect(kml).toContain('<coordinates></coordinates>');
	});
});
