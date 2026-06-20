/**
 * Generador de informes (SPEC §6): un modelo estructurado, dos salidas
 * (Markdown y la vista HTML imprimible). Puro, sin imports de Svelte.
 * Regla: toda afirmación lleva fuente; dato no verificado → "sin dato",
 * nunca inventado.
 */

import type { CustomGearDecision, GearDecision, Route, WeatherDay, WildlifeZone } from '$lib/types';
import { minutesToHhMm, type StartWindow } from '$lib/engine/startWindow';
import type { EnergyEstimate, WaterEstimate } from '$lib/engine';
import type { Aviso } from '$lib/weather/avisos';
import { formatDuration, formatKm, formatMeters } from '$lib/format';

export interface ReportInput {
	route: Route;
	/** Fecha de la salida, YYYY-MM-DD. */
	date: string;
	/** null = sin pronóstico al generar (offline o fuera de ventana). */
	weather: WeatherDay | null;
	decisions: GearDecision[];
	/** Material propio del usuario evaluado (SPECS_V3 §4), si lo hay. */
	customDecisions?: CustomGearDecision[];
	/** Agua y energía estimadas (SPECS_V3.5 §1), si se calcularon. */
	hydration?: WaterEstimate | null;
	energy?: EnergyEstimate | null;
	/** Ficha de fauna de la zona, si existe. */
	wildlife: WildlifeZone | null;
	/** Rutas alternativas resueltas (id → nombre). */
	alternatives: Array<{ id: string; name: string }>;
	/** Ventana ideal de inicio calculada (SPECS_V2 §5), si fue posible. */
	startWindow?: StartWindow | null;
	/** Avisos meteorológicos oficiales vigentes para la fecha, si se consultaron. */
	avisos?: Aviso[] | null;
	/** Ítems ya marcados en el checklist de preparación (SPECS_V2 §7). */
	checkedItems?: string[] | null;
}

export type ReportBlock =
	| { kind: 'paragraph'; text: string }
	| { kind: 'list'; items: string[] }
	| { kind: 'fields'; fields: Array<{ label: string; value: string }> };

export interface ReportSection {
	title: string;
	blocks: ReportBlock[];
}

export interface ReportModel {
	title: string;
	frontmatter: Array<[string, string | number | null]>;
	sections: ReportSection[];
}

const SIN_DATO = 'Sin dato verificado.';

function hourOf(isoLocal: string): string {
	return isoLocal.slice(11, 16);
}

function mideText(route: Route): string {
	const m = route.difficulty_mide;
	if (!m) return 'sin dato';
	return `medio ${m.medio} · itinerario ${m.itinerario} · desplazamiento ${m.desplazamiento} · esfuerzo ${m.esfuerzo}`;
}

function gearLine(decision: GearDecision, checked: string[] | null): string {
	// El informe imprimible lleva casillas; ☑ refleja el checklist (SPECS_V2 §7).
	const box = checked?.includes(decision.item.id) ? '☑' : '☐';
	const text = decision.reason ? `${decision.item.name} — ${decision.reason}` : decision.item.name;
	return `${box} ${text}`;
}

export function buildReportModel(input: ReportInput): ReportModel {
	const { route, date, weather, decisions, wildlife, alternatives } = input;
	const window = input.startWindow ?? null;
	const avisos = input.avisos ?? null;
	const checked = input.checkedItems ?? null;

	const sections: ReportSection[] = [];

	// Datos técnicos
	sections.push({
		title: 'Datos técnicos',
		blocks: [
			{
				kind: 'fields',
				fields: [
					{ label: 'Distancia', value: formatKm(route.distance_km) },
					{
						label: 'Desnivel',
						value:
							route.ascent_m !== null && route.descent_m !== null
								? `+${formatMeters(route.ascent_m)} / −${formatMeters(route.descent_m)}`
								: 'sin dato'
					},
					{
						label: 'Tiempo estimado',
						value:
							route.est_duration_min !== null ? formatDuration(route.est_duration_min) : 'sin dato'
					},
					{
						label: 'Recorrido',
						value: route.circular === null ? 'sin dato' : route.circular ? 'circular' : 'lineal'
					},
					{ label: 'MIDE', value: mideText(route) },
					{
						label: 'Inicio',
						value: `${route.start.name ? `${route.start.name} · ` : ''}${route.start.lat.toFixed(5)}, ${route.start.lon.toFixed(5)}`
					},
					{ label: 'Estado', value: route.status_detail ?? route.status }
				]
			}
		]
	});

	// Meteorología prevista
	sections.push({
		title: 'Meteorología prevista',
		blocks: weather
			? [
					{
						kind: 'fields',
						fields: [
							{
								label: 'Temperatura',
								value: `${weather.temperature_2m_min}° / ${weather.temperature_2m_max}°`
							},
							{ label: 'Prob. lluvia', value: `${weather.precipitation_probability_max}%` },
							{ label: 'Precipitación', value: `${weather.precipitation_sum} mm` },
							{ label: 'UV máx.', value: String(weather.uv_index_max) },
							{ label: 'Viento máx.', value: `${weather.wind_speed_10m_max} km/h` },
							{ label: 'Sol', value: `${hourOf(weather.sunrise)} – ${hourOf(weather.sunset)}` }
						]
					},
					{
						kind: 'paragraph',
						text: `Fuente: Open-Meteo, consultado ${weather.fetched_at}.`
					},
					...(avisos && avisos.length > 0
						? [
								{
									kind: 'list' as const,
									items: avisos.map(
										(a) =>
											`AVISO ${a.level.toUpperCase()} — ${a.event} (${a.areaDesc}), de ${hourOf(a.onset)} a ${hourOf(a.expires)}. Fuente: AEMET avisos.`
									)
								}
							]
						: [])
				]
			: [
					{
						kind: 'paragraph',
						text: 'Sin pronóstico disponible al generar el informe (sin conexión o fecha fuera de la ventana de 7 días). Las recomendaciones dependientes de meteo quedan en indeterminado.'
					}
				]
	});

	// Mejor momento para empezar: la ventana calculada (SPECS_V2 §5) tiene
	// prioridad de presentación; la recomendación manual se conserva.
	const startBlocks: ReportBlock[] = [];
	if (window && window.lightAlert) {
		startBlocks.push({ kind: 'paragraph', text: `⚠ ${window.reasons[0]}` });
	} else if (window) {
		startBlocks.push({
			kind: 'paragraph',
			text: `Sal entre las ${minutesToHhMm(window.startMin)} y las ${minutesToHhMm(window.endMin)}.`
		});
		startBlocks.push({ kind: 'list', items: window.reasons });
	}
	if (window && route.best_start_time) {
		startBlocks.push({
			kind: 'paragraph',
			text: `Recomendación de la ficha: ${route.best_start_time}.`
		});
	} else if (route.best_start_time) {
		startBlocks.push({ kind: 'paragraph', text: `${route.best_start_time} (ficha de la ruta).` });
	} else if (weather) {
		startBlocks.push({
			kind: 'paragraph',
			text: `Sin recomendación verificada para esta ruta. Como referencia: amanecer ${hourOf(weather.sunrise)}, atardecer ${hourOf(weather.sunset)} (Open-Meteo).`
		});
	} else {
		startBlocks.push({ kind: 'paragraph', text: SIN_DATO });
	}
	sections.push({ title: 'Mejor momento para empezar', blocks: startBlocks });

	// Mochila recomendada
	const enabled = decisions.filter((d) => d.status === 'enabled');
	const indeterminate = decisions.filter((d) => d.status === 'indeterminate');
	const disabled = decisions.filter((d) => d.status === 'disabled');
	const gearBlocks: ReportBlock[] = [];
	const needs: string[] = [];
	if (input.hydration) needs.push(`Agua: ${input.hydration.reason}`);
	if (input.energy) needs.push(`Energía: ${input.energy.reason}`);
	if (needs.length > 0) gearBlocks.push({ kind: 'list', items: needs });
	if (enabled.length > 0) {
		gearBlocks.push({ kind: 'paragraph', text: 'Llevar:' });
		gearBlocks.push({ kind: 'list', items: enabled.map((d) => gearLine(d, checked)) });
	}
	if (indeterminate.length > 0) {
		gearBlocks.push({
			kind: 'paragraph',
			text: 'A tu criterio (sin datos suficientes o sin regla):'
		});
		gearBlocks.push({ kind: 'list', items: indeterminate.map((d) => gearLine(d, checked)) });
	}
	if (disabled.length > 0) {
		gearBlocks.push({ kind: 'paragraph', text: 'Puedes dejarlo:' });
		gearBlocks.push({ kind: 'list', items: disabled.map((d) => gearLine(d, checked)) });
	}
	const custom = input.customDecisions ?? [];
	if (custom.length > 0) {
		gearBlocks.push({ kind: 'paragraph', text: 'Tu material:' });
		gearBlocks.push({
			kind: 'list',
			items: custom.map((d) => {
				const box = checked?.includes(d.item.id) ? '☑' : '☐';
				const text =
					d.status === 'warn' && d.reason ? `${d.item.name} — ⚠️ ${d.reason}` : d.item.name;
				return `${box} ${text}`;
			})
		});
	}
	sections.push({ title: 'Mochila recomendada', blocks: gearBlocks });

	// Puntos destacados (highlights verificados + POIs de OSM cercanos al track)
	const highlightBlocks: ReportBlock[] = [];
	if (route.highlights.length > 0) {
		highlightBlocks.push({ kind: 'list', items: route.highlights });
	}
	if (route.pois.length > 0) {
		highlightBlocks.push({ kind: 'paragraph', text: 'Puntos de interés cercanos (OSM):' });
		highlightBlocks.push({
			kind: 'list',
			items: route.pois.map((p) => `${p.name} — ${p.type} (km ${p.km}, a ${p.dist_m} m)`)
		});
	}
	if (highlightBlocks.length === 0) highlightBlocks.push({ kind: 'paragraph', text: SIN_DATO });
	sections.push({ title: 'Puntos destacados', blocks: highlightBlocks });

	// Fuentes de agua y escapes
	const waterBlocks: ReportBlock[] = [];
	waterBlocks.push({
		kind: 'paragraph',
		text:
			route.water_points.length > 0
				? 'Fuentes de agua:'
				: 'Fuentes de agua: sin datos verificados — llevar el agua necesaria desde el inicio.'
	});
	if (route.water_points.length > 0) {
		waterBlocks.push({ kind: 'list', items: route.water_points });
	}
	if (route.escape_routes.length > 0) {
		waterBlocks.push({ kind: 'paragraph', text: 'Escapes:' });
		waterBlocks.push({ kind: 'list', items: route.escape_routes });
	} else {
		waterBlocks.push({ kind: 'paragraph', text: 'Escapes: sin datos verificados.' });
	}
	sections.push({ title: 'Fuentes de agua y escapes', blocks: waterBlocks });

	// Rutas alternativas
	sections.push({
		title: 'Rutas alternativas',
		blocks:
			alternatives.length > 0
				? [{ kind: 'list', items: alternatives.map((a) => `${a.name} (${a.id})`) }]
				: [{ kind: 'paragraph', text: 'Sin alternativas registradas.' }]
	});

	// Si llueve / plan B
	sections.push({
		title: 'Si llueve / plan B',
		blocks: [
			{
				kind: 'paragraph',
				text: route.notes_rain ?? 'Sin notas específicas verificadas para esta ruta.'
			}
		]
	});

	// Fauna y seguridad
	const wildlifeBlocks: ReportBlock[] = [];
	if (wildlife) {
		wildlifeBlocks.push({ kind: 'paragraph', text: `Zona: ${wildlife.name}.` });
		wildlifeBlocks.push({
			kind: 'list',
			items: wildlife.wildlife.map((w) => `${w.species} (riesgo ${w.risk}): ${w.advice}`)
		});
		if (wildlife.other_risks.length > 0) {
			wildlifeBlocks.push({ kind: 'paragraph', text: 'Otros riesgos:' });
			wildlifeBlocks.push({ kind: 'list', items: wildlife.other_risks });
		}
	} else {
		wildlifeBlocks.push({
			kind: 'paragraph',
			text: 'Sin ficha de fauna verificada para esta zona. Precaución general: 112 ante emergencias.'
		});
	}
	sections.push({ title: 'Fauna y seguridad en la zona', blocks: wildlifeBlocks });

	// Fuentes
	const sourceItems = [...route.sources];
	if (weather) {
		sourceItems.push(
			`Pronóstico: Open-Meteo (api.open-meteo.com), consultado ${weather.fetched_at}`
		);
	}
	if (wildlife) {
		sourceItems.push(...wildlife.sources.map((s) => `Fauna (${wildlife.name}): ${s}`));
	}
	sourceItems.push(
		'Recomendación de mochila: reglas declarativas del proyecto (data/gear/rules.json)'
	);
	sections.push({ title: 'Fuentes', blocks: [{ kind: 'list', items: sourceItems }] });

	return {
		title: `${route.name}`,
		frontmatter: [
			['tipo', 'informe-ruta'],
			['ruta', route.name],
			['fecha', date],
			['distancia_km', route.distance_km],
			['desnivel_m', route.ascent_m],
			['fuente', 'FEMECV']
		],
		sections
	};
}
