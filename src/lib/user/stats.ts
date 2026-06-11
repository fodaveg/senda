/**
 * Estadísticas del diario (SPECS_V2 §8), calculadas en cliente a partir
 * de las salidas y de los datos verificados de cada ruta. Puro y testeable.
 * Solo se suman km/desnivel de rutas con dato (nunca se estima).
 */

import type { Route } from '$lib/types';
import { type UserData } from './marks';

export interface OutingEntry {
	routeId: string;
	routeName: string | null;
	date: string;
	notes: string | null;
}

export interface DiaryStats {
	totalOutings: number;
	distinctRoutes: number;
	/** Suma de km de rutas con dato; las salidas sin ruta conocida no suman. */
	totalKm: number;
	totalAscentM: number;
	byYear: Array<{ year: string; outings: number }>;
	byZone: Array<{ zone: string; outings: number }>;
	byType: Array<{ type: string; outings: number }>;
	/** Salidas ordenadas por fecha descendente. */
	outings: OutingEntry[];
}

function sortedCounts(counter: Map<string, number>): Array<{ key: string; count: number }> {
	return [...counter.entries()]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function diaryStats(data: UserData, routes: Route[]): DiaryStats {
	const byId = new Map(routes.map((r) => [r.id, r]));
	const byYear = new Map<string, number>();
	const byZone = new Map<string, number>();
	const byType = new Map<string, number>();
	const outings: OutingEntry[] = [];
	const distinct = new Set<string>();
	let totalKm = 0;
	let totalAscentM = 0;

	for (const [routeId, marks] of Object.entries(data.marks)) {
		const route = byId.get(routeId) ?? null;
		for (const outing of marks.outings ?? []) {
			distinct.add(routeId);
			outings.push({
				routeId,
				routeName: route?.name ?? null,
				date: outing.date,
				notes: outing.notes ?? null
			});
			const year = outing.date.slice(0, 4);
			byYear.set(year, (byYear.get(year) ?? 0) + 1);
			if (route) {
				totalKm += route.distance_km;
				totalAscentM += route.ascent_m ?? 0;
				if (route.zone) byZone.set(route.zone, (byZone.get(route.zone) ?? 0) + 1);
				byType.set(route.type, (byType.get(route.type) ?? 0) + 1);
			}
		}
	}
	outings.sort((a, b) => b.date.localeCompare(a.date));

	return {
		totalOutings: outings.length,
		distinctRoutes: distinct.size,
		totalKm: Math.round(totalKm * 10) / 10,
		totalAscentM,
		byYear: sortedCounts(byYear).map(({ key, count }) => ({ year: key, outings: count })),
		byZone: sortedCounts(byZone).map(({ key, count }) => ({ zone: key, outings: count })),
		byType: sortedCounts(byType).map(({ key, count }) => ({ type: key, outings: count })),
		outings
	};
}

/** Diario en Markdown compatible Obsidian (SPECS_V2 §8). */
export function diaryMarkdown(stats: DiaryStats, generatedAt: string): string {
	const lines: string[] = [
		'---',
		'tipo: diario-senderismo',
		`generado: ${generatedAt}`,
		`salidas: ${stats.totalOutings}`,
		`km_acumulados: ${stats.totalKm}`,
		`desnivel_acumulado_m: ${stats.totalAscentM}`,
		'---',
		'',
		'# Diario de salidas',
		'',
		`- **Salidas**: ${stats.totalOutings} (${stats.distinctRoutes} rutas distintas)`,
		`- **Distancia acumulada**: ${stats.totalKm} km`,
		`- **Desnivel positivo acumulado**: ${stats.totalAscentM} m`,
		'',
		'## Salidas',
		''
	];
	for (const outing of stats.outings) {
		const name = outing.routeName ?? `(ruta ${outing.routeId} ya no está en el catálogo)`;
		lines.push(`- **${outing.date}** — ${name}${outing.notes ? `: ${outing.notes}` : ''}`);
	}
	return lines.join('\n') + '\n';
}
