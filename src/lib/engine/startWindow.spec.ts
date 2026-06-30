import { describe, expect, it } from 'vitest';
import {
	isoTimeToMinutes,
	minutesToHhMm,
	startWindow,
	startWindowTimeline,
	type StartWindow
} from './startWindow';
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
		end: null,
		distance_km: 10,
		ascent_m: 400,
		descent_m: 400,
		circular: null,
		difficulty_mide: null,
		est_duration_min: 240,
		water_points: [],
		water_points_geo: [],
		pois: [],
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

describe('startWindowTimeline', () => {
	// Ventana base: día con amanecer 06:35 (395) y anochecer 21:25 (1285) →
	// eje redondeado a la hora = [06:00=360, 22:00=1320], span 960.
	function win(overrides: Partial<StartWindow>): StartWindow {
		return {
			startMin: 395,
			endMin: 1015,
			lightLimitMin: 1015,
			lightAlert: false,
			hotSpan: null,
			reasons: [],
			...overrides
		};
	}

	it('null si la ventana es de alerta de luz (no hay franja que dibujar)', () => {
		expect(startWindowTimeline(win({ lightAlert: true }), day({}))).toBeNull();
	});

	it('null si el día no aporta amanecer/anochecer utilizables', () => {
		expect(startWindowTimeline(win({}), day({ sunrise: 'sin hora' }))).toBeNull();
		expect(startWindowTimeline(win({}), day({ sunset: '2026-06-14T05:00' }))).toBeNull();
	});

	it('eje redondeado a la hora desde el amanecer hasta el anochecer', () => {
		const t = startWindowTimeline(win({}), day({}))!;
		expect(t.axisStartMin).toBe(360);
		expect(t.axisEndMin).toBe(1320);
	});

	it('franja ideal posicionada en % sobre el eje', () => {
		const t = startWindowTimeline(win({}), day({}))!;
		// left = (395−360)/960 = 3,65%; width = (1015−395)/960 = 64,58%
		expect(t.ideal.leftPct).toBeCloseTo(3.65, 1);
		expect(t.ideal.widthPct).toBeCloseTo(64.58, 1);
		expect(t.avoid).toBeNull();
	});

	it('franja de calor (avoid) cuando hay hotSpan', () => {
		const t = startWindowTimeline(win({ hotSpan: [720, 1020] }), day({}))!;
		// 720→37,5% · 1020→68,75% · ancho 31,25%
		expect(t.avoid!.leftPct).toBeCloseTo(37.5, 2);
		expect(t.avoid!.widthPct).toBeCloseTo(31.25, 2);
	});

	it('recorta al eje las franjas que se salen (clamp 0–100)', () => {
		const t = startWindowTimeline(win({ hotSpan: [1200, 1500] }), day({}))!;
		// 1200→87,5%; 1500 se sale (118,75%) → 100%; ancho 12,5%
		expect(t.avoid!.leftPct).toBeCloseTo(87.5, 2);
		expect(t.avoid!.widthPct).toBeCloseTo(12.5, 2);
	});

	it('marcas horarias repartidas, alineadas con el eje', () => {
		const t = startWindowTimeline(win({}), day({}))!;
		expect(t.ticks.map((x) => x.hour)).toEqual([6, 10, 14, 18, 22]);
		expect(t.ticks.map((x) => x.leftPct)).toEqual([0, 25, 50, 75, 100]);
	});
});

describe('helpers de tiempo', () => {
	it('isoTimeToMinutes y minutesToHhMm', () => {
		expect(isoTimeToMinutes('2026-06-14T06:35')).toBe(395);
		expect(isoTimeToMinutes('sin hora')).toBeNull();
		expect(minutesToHhMm(395)).toBe('06:35');
	});
});
