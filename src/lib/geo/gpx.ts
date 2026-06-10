/**
 * Conversión GPX→GeoJSON para renderizar el track en MapLibre (SPEC §1).
 * El parser XML se inyecta para poder usar el DOMParser nativo en el
 * navegador y @xmldom/xmldom en tests/Node.
 */

import { gpx } from '@tmcw/togeojson';
import type { FeatureCollection, Position } from 'geojson';

export interface XmlParser {
	parseFromString(xml: string, mimeType: string): unknown;
}

export function gpxToGeoJSON(xml: string, parser: XmlParser = new DOMParser()): FeatureCollection {
	// Los GPX de FEMECV (CompeGPS) pueden llevar BOM, que rompe el parser XML.
	const doc = parser.parseFromString(xml.replace(/^\uFEFF/, ''), 'text/xml');
	return gpx(doc as Parameters<typeof gpx>[0]);
}

/** Concatena las coordenadas de todos los tracks del GeoJSON, en orden. */
export function trackPositions(collection: FeatureCollection): Position[] {
	const positions: Position[] = [];
	for (const feature of collection.features) {
		const geometry = feature.geometry;
		if (geometry.type === 'LineString') {
			positions.push(...geometry.coordinates);
		} else if (geometry.type === 'MultiLineString') {
			for (const line of geometry.coordinates) positions.push(...line);
		}
	}
	return positions;
}
