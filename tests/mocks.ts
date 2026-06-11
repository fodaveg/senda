/** Utilidades compartidas de los e2e: pronóstico Open-Meteo mockeado. */

export function isoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Datos municipales AEMET mockeados, coherentes con mockPayload (sin discrepancias). */
export function aemetPayload() {
	const dia = Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() + i);
		return {
			fecha: `${isoDate(d)}T00:00:00`,
			probPrecipitacion: [{ value: 75, periodo: '00-24' }],
			temperatura: { maxima: 31, minima: 18 },
			uvMax: 8
		};
	});
	return [{ nombre: 'Chulilla', prediccion: { dia } }];
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

/** Pronóstico horario mockeado: tarde calurosa (UV alto 12–17 h). */
export function hourlyPayload() {
	const d = isoDate(new Date());
	const hours = Array.from({ length: 24 }, (_, h) => h);
	return {
		hourly: {
			time: hours.map((h) => `${d}T${String(h).padStart(2, '0')}:00`),
			temperature_2m: hours.map((h) => (h >= 12 && h <= 17 ? 31 : 22)),
			uv_index: hours.map((h) => (h >= 12 && h <= 16 ? 8 : 2)),
			precipitation_probability: hours.map(() => 10)
		}
	};
}

/** XML CAP de aviso naranja por tormentas en Valencia, vigente hoy. */
export function capXml() {
	const d = isoDate(new Date());
	return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
	<info>
		<language>es-ES</language>
		<event>Tormentas</event>
		<onset>${d}T00:00:00+02:00</onset>
		<expires>${d}T23:59:59+02:00</expires>
		<parameter><valueName>AEMET-Meteoalerta nivel</valueName><value>naranja</value></parameter>
		<area><areaDesc>Interior norte de Valencia</areaDesc></area>
	</info>
</alert>`;
}

/** tar POSIX mínimo con un único fichero, para mockear los avisos CAP. */
export function tarWith(name: string, content: string): Buffer {
	const body = Buffer.from(content, 'utf-8');
	const blocks = Math.ceil(body.length / 512);
	const buffer = Buffer.alloc(512 + blocks * 512 + 1024);
	buffer.write(name, 0, 'utf-8');
	buffer.write(body.length.toString(8).padStart(11, '0') + ' ', 124, 'utf-8');
	buffer.write('0', 156, 'utf-8');
	body.copy(buffer, 512);
	return buffer;
}
