/** Distancia haversine en metros entre dos posiciones [lon, lat]. */

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: [number, number], b: [number, number]): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b[1] - a[1]);
	const dLon = toRad(b[0] - a[0]);
	const sinLat = Math.sin(dLat / 2);
	const sinLon = Math.sin(dLon / 2);
	const h = sinLat * sinLat + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLon * sinLon;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
