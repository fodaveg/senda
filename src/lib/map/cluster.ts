/**
 * Agrupación (clustering) de marcadores por proximidad (SPECS_V4 §B6). Con ~600
 * inicios de ruta, pintar un marcador por ruta satura el mapa a poca escala;
 * aquí se agrupan en una rejilla geográfica cuyo tamaño de celda **se encoge al
 * acercar el zoom**, de modo que los grupos se van separando al hacer zoom. Puro
 * y testeable: no toca MapLibre ni el DOM.
 */

export interface MarkerPoint {
	id: string;
	lat: number;
	lon: number;
	name: string;
}

export interface MarkerCluster {
	/** Centroide del grupo (media de sus miembros). */
	lat: number;
	lon: number;
	members: MarkerPoint[];
}

/**
 * Lado de la celda de la rejilla, en grados, para un nivel de zoom. Se reduce a
 * la mitad por cada nivel (≈ comportamiento de las teselas web), de modo que a
 * más zoom hay más celdas y los grupos se separan. Acotado para que a zoom muy
 * alto cada ruta quede aislada.
 */
export function cellSizeDeg(zoom: number): number {
	return 180 / Math.pow(2, Math.max(0, zoom));
}

/**
 * Agrupa los puntos en una rejilla del tamaño correspondiente al zoom. Un grupo
 * con un solo punto representa un marcador individual; con varios, un clúster.
 * El orden de salida es estable (por la primera aparición de cada celda).
 */
export function clusterMarkers(points: MarkerPoint[], zoom: number): MarkerCluster[] {
	const size = cellSizeDeg(zoom);
	const cells = new Map<string, MarkerPoint[]>();
	const order: string[] = [];
	for (const p of points) {
		const key = `${Math.floor(p.lat / size)}|${Math.floor(p.lon / size)}`;
		let bucket = cells.get(key);
		if (!bucket) {
			bucket = [];
			cells.set(key, bucket);
			order.push(key);
		}
		bucket.push(p);
	}
	return order.map((key) => {
		const members = cells.get(key)!;
		const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
		const lon = members.reduce((s, m) => s + m.lon, 0) / members.length;
		return { lat, lon, members };
	});
}
