import { describe, expect, it } from 'vitest';
import { buildReportModel, type ReportInput } from './model';
import { renderMarkdown, reportFilename } from './markdown';
import { evaluateGear } from '$lib/engine';
import type { GearItem, GearRule, Route, WeatherDay, WildlifeZone } from '$lib/types';

const route: Route = {
	id: 'pr-cv-77',
	name: 'PR-CV 77 Chulilla - Sot de Chera',
	type: 'PR',
	status: 'homologado',
	status_detail: null,
	municipality: null,
	zone: null,
	aemet_municipio: null,
	start: { lat: 39.65, lon: -0.89, name: 'Chulilla' },
	distance_km: 5.5,
	ascent_m: 415,
	descent_m: 290,
	circular: false,
	difficulty_mide: { medio: 1, itinerario: 2, desplazamiento: 2, esfuerzo: 2 },
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
	sources: ['Ficha FEMECV (consulta 2026-06-10)']
};

const weather: WeatherDay = {
	date: '2026-06-14',
	temperature_2m_max: 30,
	temperature_2m_min: 18,
	precipitation_probability_max: 40,
	precipitation_sum: 2.5,
	uv_index_max: 8,
	wind_speed_10m_max: 20,
	sunrise: '2026-06-14T06:35',
	sunset: '2026-06-14T21:25',
	source: 'open-meteo',
	fetched_at: '2026-06-13T18:00:00Z'
};

const items: GearItem[] = [
	{ id: 'botiquin', name: 'Botiquín', category: 'seguridad', weight_g: 300, base: true },
	{ id: 'poncho', name: 'Poncho', category: 'ropa', weight_g: 230, base: false }
];
const rules: GearRule[] = [
	{
		item: 'poncho',
		when: { precipitation_probability_max: { gte: 20 } },
		action: 'enable',
		reason: 'Probabilidad de lluvia {precipitation_probability_max}%'
	}
];

function inputWith(overrides: Partial<ReportInput> = {}): ReportInput {
	return {
		route,
		date: '2026-06-14',
		weather,
		decisions: evaluateGear(route, weather, 'verano', items, rules),
		wildlife: null,
		alternatives: [],
		...overrides
	};
}

describe('buildReportModel + renderMarkdown', () => {
	const md = renderMarkdown(buildReportModel(inputWith()));

	it('frontmatter Obsidian con los campos de la spec', () => {
		expect(md.startsWith('---\n')).toBe(true);
		expect(md).toContain('tipo: informe-ruta');
		expect(md).toContain('ruta: PR-CV 77 Chulilla - Sot de Chera');
		expect(md).toContain('fecha: 2026-06-14');
		expect(md).toContain('distancia_km: 5.5');
		expect(md).toContain('desnivel_m: 415');
		expect(md).toContain('fuente: FEMECV');
	});

	it('contiene todas las secciones de la spec en orden', () => {
		const titles = [
			'## Datos técnicos',
			'## Meteorología prevista',
			'## Mejor momento para empezar',
			'## Mochila recomendada',
			'## Puntos destacados',
			'## Fuentes de agua y escapes',
			'## Rutas alternativas',
			'## Si llueve / plan B',
			'## Fauna y seguridad en la zona',
			'## Fuentes\n'
		];
		let lastIndex = -1;
		for (const title of titles) {
			const index = md.indexOf(title, lastIndex + 1);
			expect(index, `falta o está desordenada: ${title}`).toBeGreaterThan(lastIndex);
			lastIndex = index;
		}
	});

	it('la meteo cita fuente y hora de consulta', () => {
		expect(md).toContain('Fuente: Open-Meteo, consultado 2026-06-13T18:00:00Z');
	});

	it('la mochila incluye razones interpoladas', () => {
		expect(md).toContain('Poncho — Probabilidad de lluvia 40%');
		expect(md).toContain('Botiquín — Equipo base: siempre en la mochila');
	});

	it('incluye el material propio del usuario con su aviso', () => {
		const withCustom = renderMarkdown(
			buildReportModel(
				inputWith({
					customDecisions: [
						{
							item: {
								id: 'calc',
								name: 'Calcetines impermeables',
								category: 'ropa',
								weight_g: 90,
								attributes: ['abrigo']
							},
							status: 'warn',
							reason: 'Prenda de abrigo con calor'
						}
					]
				})
			)
		);
		expect(withCustom).toContain('Tu material:');
		expect(withCustom).toContain('Calcetines impermeables — ⚠️ Prenda de abrigo con calor');
	});

	it('sin fauna verificada lo dice, sin inventar especies', () => {
		expect(md).toContain('Sin ficha de fauna verificada');
		expect(md).not.toContain('oso');
	});

	it('las fuentes de la ruta aparecen en la sección Fuentes', () => {
		expect(md).toContain('- Ficha FEMECV (consulta 2026-06-10)');
		expect(md).toContain('data/gear/rules.json');
		expect(md).not.toContain('Fauna (');
	});
});

describe('informe sin pronóstico (offline)', () => {
	const md = renderMarkdown(
		buildReportModel(
			inputWith({ weather: null, decisions: evaluateGear(route, null, 'verano', items, rules) })
		)
	);

	it('lo dice explícitamente y no inventa meteo', () => {
		expect(md).toContain('Sin pronóstico disponible al generar el informe');
		expect(md).not.toContain('Open-Meteo, consultado');
	});

	it('la mochila queda a criterio, no descartada', () => {
		expect(md).toContain('A tu criterio');
		expect(md).toContain('Poncho — Sin datos suficientes');
	});
});

describe('informe con fauna', () => {
	const zone: WildlifeZone = {
		name: 'Los Serranos / Alto Turia',
		wildlife: [
			{ species: 'jabalí', risk: 'bajo', advice: 'No acercarse a crías.' },
			{ species: 'víbora hocicuda', risk: 'bajo', advice: 'Mirar dónde se ponen manos y pies.' }
		],
		other_risks: ['crecidas súbitas en el cañón del Turia'],
		sources: ['SPEC.md §7']
	};

	it('lista especies con riesgo y consejo, y cita la fuente de la ficha', () => {
		const md = renderMarkdown(buildReportModel(inputWith({ wildlife: zone })));
		expect(md).toContain('jabalí (riesgo bajo): No acercarse a crías.');
		expect(md).toContain('crecidas súbitas en el cañón del Turia');
		expect(md).toContain('Fauna (Los Serranos / Alto Turia): SPEC.md §7');
	});
});

describe('reportFilename', () => {
	it('genera informe-<id>-<fecha>.md', () => {
		expect(reportFilename('pr-cv-77', '2026-06-14')).toBe('informe-pr-cv-77-2026-06-14.md');
	});
});
