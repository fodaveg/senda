/** Formatea una distancia en kilómetros para la UI (es-ES, 1 decimal). */
export function formatKm(km: number): string {
	return `${km.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} km`;
}

/** Formatea un desnivel en metros para la UI. */
export function formatMeters(m: number): string {
	return `${m.toLocaleString('es-ES', { maximumFractionDigits: 0 })} m`;
}

/** Formatea una duración en minutos como "3 h 30 min". */
export function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const min = Math.round(minutes % 60);
	if (h === 0) return `${min} min`;
	if (min === 0) return `${h} h`;
	return `${h} h ${min} min`;
}
