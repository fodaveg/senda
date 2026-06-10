/** Utilidades compartidas de los e2e: pronóstico Open-Meteo mockeado. */

export function isoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Pronóstico mockeado: 8 días desde hoy con lluvia 80%, UV 8 y 30 °C. */
export function mockPayload() {
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
