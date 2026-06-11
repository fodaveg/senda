import { describe, expect, it } from 'vitest';
import { isoTimeToMinutes, minutesToHhMm, startWindow } from './startWindow';
import type { Route, WeatherDay } from '$lib/types';
import type { HourlyPoint } from '$lib/weather/hourly';

function route(overrides: Partial<Route>): Route {
	return {
		id: 'r',
		name: 'R',
		type: 'PR',
		status: 'homologado',
		status_detail: null,
		municipality: null,
		zone: null,
		aemet_municipio: null,
		start: { lat: 39, lon: -0.5, name: null },
		distance_km: 10,
		ascent_m: 400,
		descent_m: 400,
		circular: null,
		difficulty_mide: null,
		est_duration_min: 240,
		water_points: [],
		escape_routes: [],
		highlights: [],
		best_season: [],
		best_start_time: null,
		shade_ratio: null,
		gpx: 'r.gpx',
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		bbox: null,
		sources: ['test'],
		...overrides
	};
}

function day(overrides: Partial<WeatherDay>): WeatherDay {
	return {
		date: '2026-06-14',
		temperature_2m_max: 30,
		temperature_2m_min: 18,
		precipitation_probability_max: 10,
		precipitation_sum: 0,
		uv_index_max: 8,
		wind_speed_10m_max: 15,
		sunrise: '2026-06-14T06:35',
		sunset: '2026-06-14T21:25',
		source: 'open-meteo',
		fetched_at: 'x',
		...overrides
	};
}

function hourlyWith(hot: Array<[number, number, number]>): HourlyPoint[] {
	// [hora, temperatura, uv]
	return hot.map(([h, t, uv]) => ({
		time: `2026-06-14T${String(h).padStart(2, '0')}:00`,
		temperature_2m: t,
		uv_index: uv,
		precipitation_probability: 0
	}));
}

describe('startWindow', () => {
	it('sin duración estimada o sin pronóstico → null (nunca se inventa)', () => {
		expect(startWindow(route({ est_duration_min: null }), day({}), null)).toBeNull();
		expect(startWindow(route({}), null, null)).toBeNull();
	});

	it('restricción de luz: última salida = atardecer − duración − 30 min', () => {
		const w = startWindow(route({ est_duration_min: 240 }), day({}), null);
		// 21:25 = 1285; 1285 − 240 − 30 = 1015 = 16:55
		expect(w).not.toBeNull();
		expect(w!.lightAlert).toBe(false);
		expect(minutesToHhMm(w!.lightLimitMin)).toBe('16:55');
		expect(minutesToHhMm(w!.startMin)).toBe('06:35');
	});

	it('alerta de luz si la ruta no cabe ni saliendo al amanecer', () => {
		const shortDay = day({ sunrise: '2026-01-10T08:10', sunset: '2026-01-10T17:45' });
		const w = startWindow(route({ est_duration_min: 600 }), shortDay, null);
		expect(w!.lightAlert).toBe(true);
		expect(w!.reasons[0]).toContain('no cabe en las horas de luz');
	});

	it('con poca sombra y franja de calor, recomienda terminar antes del calor', () => {
		const hourly = hourlyWith([
			[9, 24, 4],
			[12, 29, 8],
			[13, 30, 9],
			[16, 31, 7],
			[19, 27, 3]
		]);
		const w = startWindow(route({ est_duration_min: 240, shade_ratio: 0.2 }), day({}), hourly);
		// Franja caliente 12:00–17:00; fin recomendado = 12:00 − 4 h = 08:00
		expect(w!.hotSpan).toEqual([720, 1020]);
		expect(minutesToHhMm(w!.endMin)).toBe('08:00');
		expect(w!.reasons.some((r) => r.includes('franja de calor'))).toBe(true);
	});

	it('con sombra suficiente no recorta por calor', () => {
		const hourly = hourlyWith([[13, 31, 9]]);
		const w = startWindow(route({ est_duration_min: 240, shade_ratio: 0.7 }), day({}), hourly);
		expect(w!.hotSpan).toBeNull();
		expect(minutesToHhMm(w!.endMin)).toBe('16:55');
	});

	it('si el calor es inevitable lo dice sin recortar a imposible', () => {
		const hourly = hourlyWith([
			[7, 29, 8],
			[12, 33, 9]
		]);
		const w = startWindow(route({ est_duration_min: 300, shade_ratio: 0.1 }), day({}), hourly);
		expect(w!.lightAlert).toBe(false);
		expect(
			w!.reasons.some((r) => r.includes('no se puede') || r.includes('lo antes posible'))
		).toBe(true);
		expect(w!.endMin).toBeGreaterThanOrEqual(w!.startMin);
	});
});

describe('helpers de tiempo', () => {
	it('isoTimeToMinutes y minutesToHhMm', () => {
		expect(isoTimeToMinutes('2026-06-14T06:35')).toBe(395);
		expect(isoTimeToMinutes('sin hora')).toBeNull();
		expect(minutesToHhMm(395)).toBe('06:35');
	});
});
