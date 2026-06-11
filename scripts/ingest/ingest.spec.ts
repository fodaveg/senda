import { describe, expect, it } from 'vitest';
import { parseGpx } from './gpx';
import { buildRoute, IngestError, parseCrawled, parseManual, zoneFromComarca } from './build';

function gpxOf(points: Array<[number, number, number?]>, name = 'Test'): string {
	const trkpts = points
		.map(([lat, lon, ele]) => {
			const eleTag = ele === undefined ? '' : `<ele>${ele}</ele>`;
			return `<trkpt lat="${lat}" lon="${lon}">${eleTag}</trkpt>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
	<trk><name>${name}</name><trkseg>
${trkpts}
	</trkseg></trk>
</gpx>`;
}

// 0,01° de latitud ≈ 1112 m sobre un meridiano.
const LINEAR = gpxOf([
	[39.0, -0.5, 100],
	[39.01, -0.5, 120],
	[39.02, -0.5, 110]
]);

describe('parseGpx', () => {
	it('deriva distancia, desniveles, bbox, inicio y nombre del track', () => {
		const s = parseGpx(LINEAR);
		expect(s.name).toBe('Test');
		expect(s.distance_km).toBeCloseTo(2.2, 1);
		expect(s.ascent_m).toBe(20);
		expect(s.descent_m).toBe(10);
		expect(s.start).toEqual({ lat: 39.0, lon: -0.5 });
		expect(s.bbox).toEqual([-0.5, 39.0, -0.5, 39.02]);
		expect(s.circular).toBe(false);
		expect(s.points).toBe(3);
	});

	it('detecta rutas circulares (fin a menos de 200 m del inicio)', () => {
		const square = gpxOf([
			[39.0, -0.5],
			[39.01, -0.5],
			[39.01, -0.49],
			[39.0, -0.49],
			[39.0005, -0.5]
		]);
		expect(parseGpx(square).circular).toBe(true);
	});

	it('filtra el ruido de elevación con histéresis de 3 m', () => {
		const noisy = gpxOf([
			[39.0, -0.5, 100],
			[39.001, -0.5, 101],
			[39.002, -0.5, 99.5],
			[39.003, -0.5, 110]
		]);
		const s = parseGpx(noisy);
		expect(s.ascent_m).toBe(10);
		expect(s.descent_m).toBe(0);
	});

	it('sin elevaciones devuelve desniveles null, no 0', () => {
		const flat = gpxOf([
			[39.0, -0.5],
			[39.01, -0.5]
		]);
		const s = parseGpx(flat);
		expect(s.ascent_m).toBeNull();
		expect(s.descent_m).toBeNull();
	});

	it('falla con error claro si el XML está corrupto', () => {
		expect(() => parseGpx('esto no es xml', 'roto.gpx')).toThrow(/roto\.gpx/);
	});

	it('falla si no hay track con al menos 2 puntos', () => {
		const empty = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="39" lon="-0.5"/></gpx>`;
		expect(() => parseGpx(empty, 'vacio.gpx')).toThrow(/sin track utilizable.*vacio\.gpx/);
	});
});

const MANUAL_OK = {
	name: 'PR-CV 999 Ruta de prueba',
	type: 'PR' as const,
	sources: ['FEMECV GPX 2026-06']
};

describe('parseManual', () => {
	it('exige name, type y sources', () => {
		expect(() => parseManual('pr-cv-999', { name: 'x' })).toThrow(IngestError);
		expect(() => parseManual('pr-cv-999', { ...MANUAL_OK, sources: [] })).toThrow(/_manual/);
	});

	it('rechaza claves desconocidas (detección de erratas)', () => {
		expect(() => parseManual('pr-cv-999', { ...MANUAL_OK, higlights: ['typo'] })).toThrow(
			/higlights/
		);
	});
});

describe('buildRoute', () => {
	const summary = parseGpx(LINEAR);

	it('derivados del GPX + manual mínimo: el resto queda null/[] sin inventar nada', () => {
		const route = buildRoute('pr-cv-999', summary, parseManual('pr-cv-999', MANUAL_OK));
		expect(route.id).toBe('pr-cv-999');
		expect(route.distance_km).toBe(summary.distance_km);
		expect(route.ascent_m).toBe(20);
		expect(route.circular).toBe(false);
		expect(route.gpx).toBe('pr-cv-999.gpx');
		expect(route.bbox).toEqual(summary.bbox);
		expect(route.zone).toBeNull();
		expect(route.difficulty_mide).toBeNull();
		expect(route.shade_ratio).toBeNull();
		expect(route.water_points).toEqual([]);
		// Sin estado declarado en ninguna capa no se inventa 'homologado'.
		expect(route.status).toBe('desconocido');
	});

	it('lo manual tiene prioridad sobre lo derivado y las fuentes citan el GPX', () => {
		const manual = parseManual('pr-cv-999', {
			...MANUAL_OK,
			distance_km: 2.4,
			circular: true,
			start: { name: 'Plaza del pueblo' }
		});
		const route = buildRoute('pr-cv-999', summary, manual);
		expect(route.distance_km).toBe(2.4);
		expect(route.circular).toBe(true);
		expect(route.start).toEqual({ lat: 39.0, lon: -0.5, name: 'Plaza del pueblo' });
		expect(route.sources).toEqual([
			'FEMECV GPX 2026-06',
			'GPX pr-cv-999.gpx (derivados: desniveles, inicio, bbox)'
		]);
	});

	it('la validación final rechaza rutas degeneradas (distancia 0)', () => {
		const degenerate = parseGpx(
			gpxOf([
				[39.0, -0.5, 100],
				[39.0, -0.5, 100]
			])
		);
		expect(() => buildRoute('pr-cv-999', degenerate, parseManual('pr-cv-999', MANUAL_OK))).toThrow(
			/no valida/
		);
	});

	it('el id debe ser kebab-case', () => {
		expect(() => buildRoute('PR CV 999', summary, parseManual('x', MANUAL_OK))).toThrow(
			/kebab-case/
		);
	});
});

describe('capa crawleada (SPECS_V2 §4)', () => {
	const summary = parseGpx(LINEAR);

	const CRAWLED_OK = {
		name: 'PR-CV 999 RUTA DE PRUEBA',
		type: 'PR',
		status: 'con_reservas',
		status_detail: 'Sin controles de calidad',
		municipality: 'Chulilla',
		comarca: 'Los Serranos',
		distance_km: 7.2,
		ascent_m: 300,
		descent_m: 280,
		circular: false,
		difficulty_mide: { medio: 2, itinerario: 2, desplazamiento: 2, esfuerzo: 3 },
		est_duration_min: 150,
		start_name: 'Plaza Mayor',
		femecv_url: 'https://senders.femecv.com/es/sendero/ver/pr-cv-999',
		gpx_url: 'https://femecv.blob.core.windows.net/publico/gpx/X.gpx',
		crawled_at: '2026-06-11T12:00:00Z'
	};

	it('sin manual: la ficha crawleada construye la ruta y cita la fuente', () => {
		const route = buildRoute('pr-cv-999', summary, null, parseCrawled('pr-cv-999', CRAWLED_OK));
		expect(route.name).toBe('PR-CV 999 RUTA DE PRUEBA');
		expect(route.status).toBe('con_reservas');
		expect(route.status_detail).toBe('Sin controles de calidad');
		expect(route.municipality).toBe('Chulilla');
		expect(route.zone).toBe('serranos');
		expect(route.distance_km).toBe(7.2);
		expect(route.links.femecv).toContain('/pr-cv-999');
		expect(route.sources.some((s) => s.includes('Ficha FEMECV') && s.includes('crawl'))).toBe(true);
	});

	it('lo manual (verificado) gana a lo crawleado', () => {
		const manual = parseManual('pr-cv-999', {
			...MANUAL_OK,
			distance_km: 9.9,
			zone: 'otra-zona',
			status: 'homologado'
		});
		const route = buildRoute('pr-cv-999', summary, manual, parseCrawled('pr-cv-999', CRAWLED_OK));
		expect(route.distance_km).toBe(9.9);
		expect(route.zone).toBe('otra-zona');
		expect(route.status).toBe('homologado');
	});

	it('sin manual ni crawleado → error claro', () => {
		expect(() => buildRoute('pr-cv-999', summary, null, null)).toThrow(/sin metadatos/);
	});
});

describe('zoneFromComarca', () => {
	it('quita artículo inicial y acentos: clave estable de zona', () => {
		expect(zoneFromComarca('Los Serranos')).toBe('serranos');
		expect(zoneFromComarca('La Marina Alta')).toBe('marina-alta');
		expect(zoneFromComarca("L'Alcoià")).toBe('alcoia');
		expect(zoneFromComarca('El Comtat')).toBe('comtat');
		expect(zoneFromComarca('Baix Segura/Vega Baja')).toBe('baix-segura-vega-baja');
		expect(zoneFromComarca(null)).toBeNull();
	});
});
