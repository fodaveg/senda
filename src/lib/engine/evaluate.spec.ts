import { describe, expect, it } from 'vitest';
import { evaluateGear } from './evaluate';
import type { GearDecision, GearItem, GearRule, Route, WeatherDay } from '$lib/types';
import catalogJson from '../../../data/gear/items.json';
import rulesJson from '../../../data/gear/rules.json';

const catalog = catalogJson as GearItem[];
const catalogRules = rulesJson as unknown as GearRule[];

function makeRoute(overrides: Partial<Route> = {}): Route {
	return {
		id: 'pr-cv-test',
		name: 'PR-CV Test',
		type: 'PR',
		status: 'homologado',
		zone: null,
		start: { lat: 39.654, lon: -0.889, name: null },
		distance_km: 11.2,
		ascent_m: 420,
		descent_m: 420,
		circular: true,
		difficulty_mide: null,
		est_duration_min: 210,
		water_points: [],
		escape_routes: [],
		highlights: [],
		best_season: [],
		best_start_time: null,
		shade_ratio: 0.3,
		gpx: 'pr-cv-test.gpx',
		links: { femecv: null, wikiloc: null },
		alternatives: [],
		notes_rain: null,
		sources: ['test'],
		...overrides
	};
}

function makeWeather(overrides: Partial<WeatherDay> = {}): WeatherDay {
	return {
		date: '2026-06-14',
		temperature_2m_max: 22,
		temperature_2m_min: 12,
		precipitation_probability_max: 10,
		precipitation_sum: 0.5,
		uv_index_max: 4,
		wind_speed_10m_max: 15,
		sunrise: '2026-06-14T06:35',
		sunset: '2026-06-14T21:25',
		source: 'open-meteo',
		fetched_at: '2026-06-13T18:00:00Z',
		...overrides
	};
}

function item(id: string, overrides: Partial<GearItem> = {}): GearItem {
	return { id, name: id, category: 'test', weight_g: null, base: false, ...overrides };
}

function decisionOf(decisions: GearDecision[], id: string): GearDecision {
	const found = decisions.find((d) => d.item.id === id);
	if (!found) throw new Error(`No hay decisión para ${id}`);
	return found;
}

describe('reglas enable/disable con el catálogo real', () => {
	it('habilita el poncho con probabilidad de lluvia alta e interpola la razón', () => {
		const decisions = evaluateGear(
			makeRoute(),
			makeWeather({ precipitation_probability_max: 40 }),
			'primavera',
			catalog,
			catalogRules
		);
		const poncho = decisionOf(decisions, 'poncho');
		expect(poncho.status).toBe('enabled');
		expect(poncho.reason).toBe('Probabilidad de lluvia 40%');
		expect(poncho.source).toBe('rule');
	});

	it('deshabilita el poncho con 0% de lluvia (gana la regla más específica)', () => {
		const decisions = evaluateGear(
			makeRoute(),
			makeWeather({ precipitation_probability_max: 0, precipitation_sum: 0 }),
			'verano',
			catalog,
			catalogRules
		);
		expect(decisionOf(decisions, 'poncho').status).toBe('disabled');
	});

	it('deja el poncho indeterminado en la zona gris (5–20%) sin regla aplicable', () => {
		const decisions = evaluateGear(
			makeRoute(),
			makeWeather({ precipitation_probability_max: 10, precipitation_sum: 0.5 }),
			'otoño',
			catalog,
			catalogRules
		);
		const poncho = decisionOf(decisions, 'poncho');
		expect(poncho.status).toBe('indeterminate');
		expect(poncho.reason).toBeNull();
		expect(poncho.source).toBe('default');
	});

	it('habilita crema solar con prioridad alta a partir de UV 6', () => {
		const decisions = evaluateGear(
			makeRoute(),
			makeWeather({ uv_index_max: 8 }),
			'verano',
			catalog,
			catalogRules
		);
		const crema = decisionOf(decisions, 'crema_solar');
		expect(crema.status).toBe('enabled');
		expect(crema.priority).toBe('alta');
		expect(crema.reason).toBe('UV 8: reaplicar cada 2 h');
	});

	it('habilita agua extra con calor y sin fuentes (route.water_points.length)', () => {
		const decisions = evaluateGear(
			makeRoute({ water_points: [] }),
			makeWeather({ temperature_2m_max: 31 }),
			'verano',
			catalog,
			catalogRules
		);
		expect(decisionOf(decisions, 'agua_extra_1l').status).toBe('enabled');
	});

	it('no recomienda agua extra si hay fuentes en ruta', () => {
		const decisions = evaluateGear(
			makeRoute({ water_points: ['Fuente del Berro (km 4,1)'] }),
			makeWeather({ temperature_2m_max: 31 }),
			'verano',
			catalog,
			catalogRules
		);
		expect(decisionOf(decisions, 'agua_extra_1l').status).toBe('indeterminate');
	});
});

describe('sustituciones (replaces)', () => {
	it('el gorro de ala sustituye a la gorra con UV alto y poca sombra', () => {
		const decisions = evaluateGear(
			makeRoute({ shade_ratio: 0.3 }),
			makeWeather({ uv_index_max: 8 }),
			'verano',
			catalog,
			catalogRules
		);
		const gorro = decisionOf(decisions, 'gorro_ala');
		const gorra = decisionOf(decisions, 'gorra');
		expect(gorro.status).toBe('enabled');
		expect(gorro.replaces).toBe('gorra');
		expect(gorra.status).toBe('disabled');
		expect(gorra.replacedBy).toBe('gorro_ala');
		expect(gorra.source).toBe('replaced');
		expect(gorra.reason).toContain('Sustituido por');
	});

	it('no hay sustitución si la regla del gorro no aplica (mucha sombra)', () => {
		const decisions = evaluateGear(
			makeRoute({ shade_ratio: 0.8 }),
			makeWeather({ uv_index_max: 8 }),
			'verano',
			catalog,
			catalogRules
		);
		expect(decisionOf(decisions, 'gorro_ala').status).toBe('indeterminate');
		expect(decisionOf(decisions, 'gorra').status).toBe('indeterminate');
	});

	it('una sustitución no puede deshabilitar un ítem base', () => {
		const items = [item('a'), item('b', { base: true })];
		const rules: GearRule[] = [
			{
				item: 'a',
				when: { 'route.distance_km': { gte: 0 } },
				action: 'enable',
				reason: 'siempre',
				replaces: 'b'
			}
		];
		const decisions = evaluateGear(makeRoute(), makeWeather(), 'verano', items, rules);
		expect(decisionOf(decisions, 'b').status).toBe('enabled');
	});
});

describe('conflictos y empates', () => {
	it('gana la regla más específica aunque sea disable', () => {
		const items = [item('x')];
		const rules: GearRule[] = [
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 5 } },
				action: 'enable',
				reason: 'larga'
			},
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 5 }, 'route.circular': { eq: true } },
				action: 'disable',
				reason: 'larga pero circular'
			}
		];
		const decisions = evaluateGear(makeRoute(), makeWeather(), 'verano', items, rules);
		expect(decisionOf(decisions, 'x').status).toBe('disabled');
		expect(decisionOf(decisions, 'x').reason).toBe('larga pero circular');
	});

	it('en empate de especificidad, enable gana a disable (fail-safe)', () => {
		const items = [item('x')];
		const rules: GearRule[] = [
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 5 } },
				action: 'disable',
				reason: 'no'
			},
			{
				item: 'x',
				when: { 'route.circular': { eq: true } },
				action: 'enable',
				reason: 'sí'
			}
		];
		const decisions = evaluateGear(makeRoute(), makeWeather(), 'verano', items, rules);
		expect(decisionOf(decisions, 'x').status).toBe('enabled');
	});

	it('cuenta operadores, no claves: dos operadores sobre una clave son más específicos', () => {
		const items = [item('x')];
		const rules: GearRule[] = [
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 5, lt: 20 } },
				action: 'disable',
				reason: 'rango'
			},
			{
				item: 'x',
				when: { 'route.circular': { eq: true } },
				action: 'enable',
				reason: 'circular'
			}
		];
		const decisions = evaluateGear(makeRoute(), makeWeather(), 'verano', items, rules);
		expect(decisionOf(decisions, 'x').status).toBe('disabled');
	});
});

describe('equipo base', () => {
	it('siempre está habilitado y las reglas no pueden deshabilitarlo', () => {
		const rules: GearRule[] = [
			...catalogRules,
			{
				item: 'agua',
				when: { 'route.distance_km': { gte: 0 } },
				action: 'disable',
				reason: 'nunca debería aplicar'
			}
		];
		const decisions = evaluateGear(makeRoute(), makeWeather(), 'verano', catalog, rules);
		for (const id of ['botiquin', 'agua', 'movil', 'frontal', 'manta_termica', 'silbato']) {
			const d = decisionOf(decisions, id);
			expect(d.status).toBe('enabled');
			expect(d.source).toBe('base');
		}
		expect(decisionOf(decisions, 'agua').reason).toBe('Equipo base: siempre en la mochila');
	});
});

describe('indeterminate por falta de datos', () => {
	it('sin pronóstico, las reglas meteo quedan indeterminadas (nunca un falso disable)', () => {
		const decisions = evaluateGear(makeRoute(), null, 'verano', catalog, catalogRules);
		for (const id of ['poncho', 'gorro_ala', 'crema_solar', 'agua_extra_1l']) {
			const d = decisionOf(decisions, id);
			expect(d.status).toBe('indeterminate');
			expect(d.reason).toContain('Sin datos');
		}
		expect(decisionOf(decisions, 'botiquin').status).toBe('enabled');
	});

	it('sin pronóstico, las reglas que solo dependen de la ruta siguen funcionando', () => {
		const items = [item('bastones')];
		const rules: GearRule[] = [
			{
				item: 'bastones',
				when: { 'route.ascent_m': { gte: 400 } },
				action: 'enable',
				reason: 'Desnivel de {route.ascent_m} m'
			}
		];
		const decisions = evaluateGear(makeRoute(), null, 'verano', items, rules);
		const d = decisionOf(decisions, 'bastones');
		expect(d.status).toBe('enabled');
		expect(d.reason).toBe('Desnivel de 420 m');
	});

	it('un campo de ruta null deja la regla indeterminada', () => {
		const items = [item('gorro_ala')];
		const rules = catalogRules.filter((r) => r.item === 'gorro_ala');
		const decisions = evaluateGear(
			makeRoute({ shade_ratio: null }),
			makeWeather({ uv_index_max: 9 }),
			'verano',
			items,
			rules
		);
		expect(decisionOf(decisions, 'gorro_ala').status).toBe('indeterminate');
	});

	it('una regla no evaluable más específica y de acción contraria fuerza indeterminate', () => {
		const items = [item('x')];
		const rules: GearRule[] = [
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 5 } },
				action: 'enable',
				reason: 'larga'
			},
			{
				item: 'x',
				when: { temperature_2m_max: { gte: 30 }, uv_index_max: { gte: 7 } },
				action: 'disable',
				reason: 'demasiado sol'
			}
		];
		const decisions = evaluateGear(makeRoute(), null, 'verano', items, rules);
		expect(decisionOf(decisions, 'x').status).toBe('indeterminate');
	});

	it('una regla no evaluable que no puede ganar no afecta al resultado', () => {
		const items = [item('x')];
		const rules: GearRule[] = [
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 5 }, 'route.circular': { eq: true } },
				action: 'enable',
				reason: 'larga y circular'
			},
			{
				item: 'x',
				when: { temperature_2m_max: { gte: 30 } },
				action: 'disable',
				reason: 'calor'
			}
		];
		const decisions = evaluateGear(makeRoute(), null, 'verano', items, rules);
		expect(decisionOf(decisions, 'x').status).toBe('enabled');
	});

	it('false AND desconocido = false: si una condición evaluable falla, la regla no aplica', () => {
		const items = [item('x')];
		const rules: GearRule[] = [
			{
				item: 'x',
				when: { 'route.distance_km': { gte: 100 }, temperature_2m_max: { gte: 30 } },
				action: 'enable',
				reason: 'imposible'
			}
		];
		const decisions = evaluateGear(makeRoute(), null, 'verano', items, rules);
		const d = decisionOf(decisions, 'x');
		expect(d.status).toBe('indeterminate');
		expect(d.source).toBe('default');
	});
});

describe('operadores y contexto', () => {
	it('soporta in sobre la estación', () => {
		const items = [item('camiseta_recambio')];
		const rules: GearRule[] = [
			{
				item: 'camiseta_recambio',
				when: { season: { in: ['verano'] } },
				action: 'enable',
				reason: 'Sudor en {season}'
			}
		];
		const verano = evaluateGear(makeRoute(), makeWeather(), 'verano', items, rules);
		const invierno = evaluateGear(makeRoute(), makeWeather(), 'invierno', items, rules);
		expect(decisionOf(verano, 'camiseta_recambio').status).toBe('enabled');
		expect(decisionOf(verano, 'camiseta_recambio').reason).toBe('Sudor en verano');
		expect(decisionOf(invierno, 'camiseta_recambio').status).toBe('indeterminate');
	});

	it('los límites de los operadores son correctos (gte/gt/lte/lt)', () => {
		const items = [item('x')];
		const ruleFor = (op: 'gte' | 'gt' | 'lte' | 'lt'): GearRule[] => [
			{ item: 'x', when: { uv_index_max: { [op]: 7 } }, action: 'enable', reason: op }
		];
		const at7 = (rules: GearRule[]) =>
			decisionOf(
				evaluateGear(makeRoute(), makeWeather({ uv_index_max: 7 }), 'verano', items, rules),
				'x'
			).status;
		expect(at7(ruleFor('gte'))).toBe('enabled');
		expect(at7(ruleFor('gt'))).toBe('indeterminate');
		expect(at7(ruleFor('lte'))).toBe('enabled');
		expect(at7(ruleFor('lt'))).toBe('indeterminate');
	});
});

describe('coherencia de los datos reales', () => {
	it('toda regla referencia ítems existentes en el catálogo', () => {
		const ids = new Set(catalog.map((i) => i.id));
		for (const rule of catalogRules) {
			expect(ids.has(rule.item), `ítem desconocido: ${rule.item}`).toBe(true);
			if (rule.replaces) {
				expect(ids.has(rule.replaces), `replaces desconocido: ${rule.replaces}`).toBe(true);
			}
		}
	});

	it('el catálogo no tiene ids duplicados y los base son los seis de la spec', () => {
		const ids = catalog.map((i) => i.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(catalog.filter((i) => i.base).map((i) => i.id)).toEqual([
			'botiquin',
			'agua',
			'movil',
			'frontal',
			'manta_termica',
			'silbato'
		]);
	});
});
