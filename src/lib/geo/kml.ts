/**
 * Exportación de la traza a KML (Google Earth / muchos GPS). Función pura: toma
 * el GeoJSON ya derivado del GPX FEMECV y emite un KML con una única línea. No
 * inventa datos: solo reproyecta las coordenadas existentes (lon,lat[,ele]).
 */

import type { FeatureCollection, Position } from 'geojson';

/** Escapa los caracteres especiales de XML en texto (nombre de la ruta). */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Aplana las coordenadas de todas las líneas (LineString/MultiLineString). */
function lineCoordinates(collection: FeatureCollection): Position[] {
	const coords: Position[] = [];
	for (const feature of collection.features) {
		const geometry = feature.geometry;
		if (geometry.type === 'LineString') {
			coords.push(...geometry.coordinates);
		} else if (geometry.type === 'MultiLineString') {
			for (const line of geometry.coordinates) coords.push(...line);
		}
	}
	return coords;
}

/**
 * Convierte una FeatureCollection (traza) a un documento KML con una
 * `Placemark`/`LineString`. `name` titula el documento. Coordenadas en formato
 * KML `lon,lat[,ele]` separadas por espacios.
 */
export function geojsonToKml(collection: FeatureCollection, name: string): string {
	const coords = lineCoordinates(collection)
		.map((p) => (p.length >= 3 ? `${p[0]},${p[1]},${p[2]}` : `${p[0]},${p[1]}`))
		.join(' ');
	const safeName = escapeXml(name);
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<kml xmlns="http://www.opengis.net/kml/2.2">\n' +
		'  <Document>\n' +
		`    <name>${safeName}</name>\n` +
		'    <Placemark>\n' +
		`      <name>${safeName}</name>\n` +
		'      <LineString>\n' +
		`        <coordinates>${coords}</coordinates>\n` +
		'      </LineString>\n' +
		'    </Placemark>\n' +
		'  </Document>\n' +
		'</kml>\n'
	);
}
