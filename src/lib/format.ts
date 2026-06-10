/** Formatea una distancia en kilómetros para la UI (es-ES, 1 decimal). */
export function formatKm(km: number): string {
	return `${km.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} km`;
}

/** Formatea un desnivel en metros para la UI. */
export function formatMeters(m: number): string {
	return `${m.toLocaleString('es-ES', { maximumFractionDigits: 0 })} m`;
}
