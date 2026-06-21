import { describe, expect, it } from 'vitest';
import {
	emptyUserData,
	isDone,
	parseUserDataImport,
	UserImportError,
	withOuting,
	withoutOuting,
	withToggledMark
} from './marks';
import { diaryMarkdown, diaryStats } from './stats';
import type { Route } from '$lib/types';

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
		est_duration_min: null,
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

describe('marcas de usuario', () => {
	it('toggle invierte la marca sin tocar las demás', () => {
		let data = withToggledMark(emptyUserData(), 'pr-1', 'favorita');
		expect(data.marks['pr-1'].favorita).toBe(true);
		data = withToggledMark(data, 'pr-1', 'me_gusta');
		expect(data.marks['pr-1']).toMatchObject({ favorita: true, me_gusta: true });
		data = withToggledMark(data, 'pr-1', 'favorita');
		expect(data.marks['pr-1'].favorita).toBe(false);
	});

	it('hecha = al menos una salida; las salidas se ordenan por fecha desc', () => {
		let data = emptyUserData();
		expect(isDone(data.marks['pr-1'])).toBe(false);
		data = withOuting(data, 'pr-1', { date: '2026-01-10' });
		data = withOuting(data, 'pr-1', { date: '2026-03-05', notes: 'con niebla' });
		expect(isDone(data.marks['pr-1'])).toBe(true);
		expect(data.marks['pr-1'].outings!.map((o) => o.date)).toEqual(['2026-03-05', '2026-01-10']);
		data = withoutOuting(data, 'pr-1', 0);
		expect(data.marks['pr-1'].outings).toHaveLength(1);
	});

	it('la importación valida con zod y rechaza copias corruptas enteras', () => {
		const good = JSON.stringify({
			schema: 1,
			marks: { 'pr-1': { favorita: true, outings: [{ date: '2026-01-01' }] } }
		});
		expect(parseUserDataImport(good).marks['pr-1'].favorita).toBe(true);
		expect(() => parseUserDataImport('no json')).toThrow(UserImportError);
		expect(() => parseUserDataImport('{"schema":99,"marks":{}}')).toThrow(UserImportError);
		expect(() =>
			parseUserDataImport('{"schema":1,"marks":{"x":{"outings":[{"date":"ayer"}]}}}')
		).toThrow(UserImportError);
	});
});

describe('diaryStats', () => {
	const routes = [
		route({ id: 'pr-1', name: 'PR 1', distance_km: 10, ascent_m: 400, zone: 'serranos' }),
		route({ id: 'gr-1', name: 'GR 1', type: 'GR', distance_km: 20, ascent_m: null, zone: 'ports' })
	];

	it('acumula km y desnivel solo de rutas con dato, y desglosa', () => {
		let data = emptyUserData();
		data = withOuting(data, 'pr-1', { date: '2026-03-05' });
		data = withOuting(data, 'pr-1', { date: '2025-11-02' });
		data = withOuting(data, 'gr-1', { date: '2026-01-15', notes: 'etapa 1' });
		const stats = diaryStats(data, routes);
		expect(stats.totalOutings).toBe(3);
		expect(stats.distinctRoutes).toBe(2);
		expect(stats.totalKm).toBe(40); // 10+10+20
		expect(stats.totalAscentM).toBe(800); // el GR sin dato no suma
		expect(stats.byYear).toEqual([
			{ year: '2026', outings: 2 },
			{ year: '2025', outings: 1 }
		]);
		expect(stats.byZone[0]).toEqual({ zone: 'serranos', outings: 2 });
		expect(stats.outings[0].date).toBe('2026-03-05');
	});

	it('una salida de una ruta fuera del catálogo no rompe ni suma km', () => {
		const data = withOuting(emptyUserData(), 'desaparecida', { date: '2026-02-01' });
		const stats = diaryStats(data, routes);
		expect(stats.totalOutings).toBe(1);
		expect(stats.totalKm).toBe(0);
		expect(stats.outings[0].routeName).toBeNull();
	});

	it('el Markdown del diario lleva frontmatter y una línea por salida', () => {
		const data = withOuting(emptyUserData(), 'pr-1', { date: '2026-03-05', notes: 'genial' });
		const md = diaryMarkdown(diaryStats(data, routes), '2026-06-11');
		expect(md).toContain('tipo: diario-senderismo');
		expect(md).toContain('- **2026-03-05** — PR 1: genial');
	});
});
