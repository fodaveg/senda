import { describe, expect, it } from 'vitest';
import {
	buildEmergencyModel,
	emergencyPlainText,
	emergencyTimes,
	type EmergencyInput
} from './emergency';
import { renderMarkdown } from './markdown';
import type { Route } from '$lib/types';

const ROUTE: Route = {
	id: 'pr-cv-77',
	name: 'PR-CV 77 Chulilla - Sot de Chera',
	type: 'PR',
	status: 'con_reservas',
	status_detail: 'Sin controles de calidad',
	municipality: 'Chulilla',
	zone: 'serranos',
	aemet_municipio: null,
	start: { lat: 39.65448, lon: -0.88923, name: 'Plaza de la Baronia' },
	end: null,
	distance_km: 5.5,
	ascent_m: 415,
	descent_m: 290,
	circular: false,
	difficulty_mide: null,
	est_duration_min: 130,
	water_points: [],
	water_points_geo: [],
	pois: [],
	escape_routes: [],
	highlights: [],
	best_season: [],
	best_start_time: null,
	shade_ratio: null,
	gpx: 'pr-cv-77.gpx',
	links: { femecv: 'https://senders.femecv.com/es/sendero/ver/pr-cv-77', wikiloc: null },
	alternatives: [],
	notes_rain: null,
	bbox: null,
	sources: ['test']
};

function input(overrides: Partial<EmergencyInput> = {}): EmergencyInput {
	return {
		route: ROUTE,
		date: '2026-06-14',
		startHhMm: '08:00',
		companions: '',
		person: {
			name: 'David',
			phone: '600 000 000',
			medical: '',
			vehicle: 'Coche gris 1234-ABC en el parking del inicio',
			clothing: '',
			alarmMarginMin: 120
		},
		weather: null,
		avisos: null,
		...overrides
	};
}

describe('emergencyTimes', () => {
	it('fin = salida + duración; alarma = fin + margen', () => {
		const times = emergencyTimes(input());
		// 08:00 + 2h10 = 10:10; +120 min = 12:10
		expect(times).toEqual({ startMin: 480, endMin: 610, alarmMin: 730 });
	});

	it('sin duración oficial no estima fin ni alarma', () => {
		const times = emergencyTimes(input({ route: { ...ROUTE, est_duration_min: null } }));
		expect(times).toEqual({ startMin: 480, endMin: null, alarmMin: null });
	});

	it('hora ilegible → null', () => {
		expect(emergencyTimes(input({ startHhMm: 'pronto' }))).toBeNull();
	});
});

describe('buildEmergencyModel', () => {
	it('lleva plan horario con hora límite, 112, coordenadas y cobertura', () => {
		const md = renderMarkdown(buildEmergencyModel(input()));
		expect(md).toContain('HORA LÍMITE DE ALARMA');
		expect(md).toContain('12:10');
		expect(md).toContain('112');
		expect(md).toContain('39.65448, -0.88923');
		expect(md).toContain('cobertura móvil puede ser limitada');
		expect(md).toContain('Vehículo');
		expect(md).toContain('tipo: ficha-emergencia');
	});

	it('sin acompañantes destaca que va solo', () => {
		const md = renderMarkdown(buildEmergencyModel(input({ companions: '' })));
		expect(md).toContain('VA SOLO/A');
		const md2 = renderMarkdown(buildEmergencyModel(input({ companions: 'Marta' })));
		expect(md2).toContain('Marta');
		expect(md2).not.toContain('VA SOLO/A');
	});

	it('los campos vacíos se omiten (sin "sin datos" que ensucien)', () => {
		const noVehicle = input();
		noVehicle.person = { ...noVehicle.person, vehicle: '', medical: '' };
		const md = renderMarkdown(buildEmergencyModel(noVehicle));
		expect(md).not.toContain('## Vehículo');
		expect(md).not.toContain('Datos médicos');
	});

	it('la alarma pasada la medianoche se marca como día siguiente', () => {
		const md = renderMarkdown(buildEmergencyModel(input({ startHhMm: '21:30' })));
		expect(md).toContain('día siguiente');
	});
});

describe('emergencyPlainText', () => {
	it('texto compacto con alarma, 112 y enlace al inicio', () => {
		const text = emergencyPlainText(input());
		expect(text).toContain('SI A LAS 12:10 NO HE AVISADO, LLAMA AL 112');
		expect(text).toContain('openstreetmap.org');
		expect(text).toContain('VOY SOLO/A');
		expect(text.split('\n').length).toBeLessThan(10);
	});
});
