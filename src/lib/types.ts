/**
 * Tipos compartidos del proyecto (SPEC.md §3–§5).
 * Este módulo es puro: sin imports de Svelte ni de UI.
 */

// ─── Rutas (SPEC §3) ────────────────────────────────────────────────────────

export type RouteType = 'GR' | 'PR' | 'SL';

/**
 * Clasificación de la app a partir del estado de homologación que publica
 * el portal FEMECV (SPECS_V2 §3). El literal exacto del portal se conserva
 * en `status_detail`.
 * - homologado: "En vigor", "Control de calidad positivo"
 * - con_reservas: "Sin controles de calidad", "Control de calidad
 *   condicionado", "Control de calidad negativo"
 * - en_proceso: "En proceso de homologación", "En proceso de revisión"
 * - deshabilitado: "Cancelación temporal", "Baja / Deshomologado"
 */
export type RouteStatus =
	| 'homologado'
	| 'con_reservas'
	| 'en_proceso'
	| 'deshabilitado'
	| 'desconocido';

export interface RouteStart {
	lat: number;
	lon: number;
	name: string | null;
}

/** Valoración MIDE (1–5 por apartado). */
export interface DifficultyMide {
	medio: number;
	itinerario: number;
	desplazamiento: number;
	esfuerzo: number;
}

export interface RouteLinks {
	femecv: string | null;
	/** Solo enlace manual opcional; Wikiloc no se integra como fuente de datos. */
	wikiloc: string | null;
}

/**
 * Ruta homologada FEMECV. Dato no verificado → null (nunca inventado),
 * con la entrada correspondiente en `sources`.
 */
/** Fuente de agua georreferenciada cerca del track (OSM, SPECS_V3 §5). */
export interface WaterPointGeo {
	name: string | null;
	kind: 'fuente' | 'manantial';
	lat: number;
	lon: number;
	/** km acumulado del track del punto más cercano. */
	km: number;
	/** Distancia al track en metros. */
	dist_m: number;
}

export type PoiType = 'mirador' | 'cumbre' | 'patrimonio' | 'refugio' | 'otro';

/** Punto de interés georreferenciado cerca del track (OSM, SPECS_V3 §5). */
export interface Poi {
	name: string;
	type: PoiType;
	lat: number;
	lon: number;
	km: number;
	dist_m: number;
}

/**
 * Qué categorías de datos publica la fuente oficial de una ruta (multi-federación
 * V5-1). Distingue "la fuente no expone este dato" (capability `false` → la UI
 * muestra una guarda "(Federación X) no publica este dato") de "dato desconocido"
 * (campo a `null` con la fuente publicándolo). FEMECV (CV) las tiene todas a
 * `true`; otras federaciones, solo las que exponen públicamente.
 */
export interface RouteCapabilities {
	/** Estado de homologación oficial (en vigor / baja…). */
	estado: boolean;
	/** Valoración MIDE / dificultad estructurada. */
	mide: boolean;
	/** Puntos de agua oficiales. */
	agua: boolean;
	/** Relación de etapas / ruta padre. */
	etapas: boolean;
	/** Descripción, puntos destacados y notas (p. ej. "si llueve"). */
	descripcion: boolean;
	/** Fauna y riesgos de la zona. */
	fauna: boolean;
	/** Rutas de escape / puntos de salida. */
	escapes: boolean;
}

export interface Route {
	id: string;
	name: string;
	type: RouteType;
	status: RouteStatus;
	/** Literal del estado de homologación publicado por el portal FEMECV. */
	status_detail: string | null;
	/** Municipio de referencia según la ficha FEMECV. */
	municipality: string | null;
	/** Clave de data/wildlife/zones.json. */
	zone: string | null;
	/** Código INE de 5 dígitos del municipio (para AEMET OpenData). */
	aemet_municipio: string | null;
	start: RouteStart;
	/** Punto final del track (para enlazar rutas, SPECS_V3.5 §5); null si no se derivó. */
	end: { lat: number; lon: number } | null;
	distance_km: number;
	ascent_m: number | null;
	descent_m: number | null;
	circular: boolean | null;
	difficulty_mide: DifficultyMide | null;
	est_duration_min: number | null;
	water_points: string[];
	/** Fuentes con coordenadas para pintarlas en el mapa (OSM, SPECS_V3 §5). */
	water_points_geo: WaterPointGeo[];
	/** Puntos de interés georreferenciados cerca del track (OSM, SPECS_V3 §5). */
	pois: Poi[];
	escape_routes: string[];
	highlights: string[];
	/** Meses recomendados en abreviatura es: "ene" … "dic". */
	best_season: string[];
	best_start_time: string | null;
	/** Proporción de sombra estimada, 0–1. */
	shade_ratio: number | null;
	/** Nombre de fichero en data/gpx/. */
	gpx: string;
	links: RouteLinks;
	/** Ids de rutas alternativas cercanas. */
	alternatives: string[];
	notes_rain: string | null;
	/** [minLon, minLat, maxLon, maxLat] derivado del GPX en la ingesta. */
	bbox: [number, number, number, number] | null;
	sources: string[];
	/**
	 * Federación/fuente oficial de la ruta (multi-federación V5-1). Opcional: el
	 * catálogo FEMECV existente no lo trae y el esquema lo rellena con "FEMECV".
	 */
	federacion?: string;
	/** Comunidad autónoma de la ruta (multi-federación V5-1). */
	comunidad?: string;
	/** Qué publica la fuente, para las guardas de la ficha (ver RouteCapabilities). */
	capabilities?: RouteCapabilities;
}

// ─── Meteo (SPEC §4) ────────────────────────────────────────────────────────

export type WeatherSource = 'open-meteo' | 'aemet';

/** Pronóstico diario normalizado que consume el motor de reglas. */
export interface WeatherDay {
	/** Fecha del pronóstico, YYYY-MM-DD. */
	date: string;
	temperature_2m_max: number;
	temperature_2m_min: number;
	/** Probabilidad máxima de precipitación, 0–100. */
	precipitation_probability_max: number;
	/** Precipitación total prevista, mm. */
	precipitation_sum: number;
	uv_index_max: number;
	wind_speed_10m_max: number;
	/** Hora local ISO. */
	sunrise: string;
	sunset: string;
	source: WeatherSource;
	/** Timestamp ISO de la consulta (para citar la fuente en informes). */
	fetched_at: string;
}

export type Season = 'invierno' | 'primavera' | 'verano' | 'otoño';

// ─── Fauna y seguridad (SPEC §7) ────────────────────────────────────────────

export type WildlifeRisk = 'bajo' | 'medio' | 'alto';

export interface WildlifeSpecies {
	species: string;
	risk: WildlifeRisk;
	advice: string;
}

/** Ficha de fauna/riesgos por zona (data/wildlife/zones.json). */
export interface WildlifeZone {
	name: string;
	wildlife: WildlifeSpecies[];
	other_risks: string[];
	/** Origen de los datos de la ficha (obligatorio: nada sin fuente). */
	sources: string[];
}

// ─── Mochila (SPEC §5) ──────────────────────────────────────────────────────

export interface GearItem {
	id: string;
	name: string;
	category: string;
	weight_g: number | null;
	/** true = siempre en mochila; las reglas no pueden deshabilitarlo. */
	base: boolean;
}

export type GearOperator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'in';

export type GearConditionValue = number | string | boolean | Array<number | string>;

/** Comparadores aplicados a una misma clave de contexto, p. ej. { gte: 20 }. */
export type GearCondition = Partial<Record<GearOperator, GearConditionValue>>;

export type GearAction = 'enable' | 'disable';

export type GearPriority = 'alta' | 'media' | 'baja';

/**
 * Regla condicional sobre un ítem. Las claves de `when` se resuelven contra:
 * - variables meteo de WeatherDay (clave directa, p. ej. "uv_index_max"),
 * - campos de ruta con prefijo "route." (admite ".length" final),
 * - la estación con la clave "season".
 * Las condiciones de un mismo `when` se combinan con AND.
 */
export interface GearRule {
	item: string;
	when: Record<string, GearCondition>;
	action: GearAction;
	/** Plantilla con interpolación {clave_de_contexto}, siempre visible en la UI. */
	reason: string;
	priority?: GearPriority;
	/** Id del ítem al que sustituye cuando esta regla habilita el suyo. */
	replaces?: string;
}

export type GearStatus = 'enabled' | 'disabled' | 'indeterminate';

/** Origen de la decisión: equipo base, regla ganadora, sustitución o ausencia de reglas. */
export type GearDecisionSource = 'base' | 'rule' | 'replaced' | 'default';

export interface GearDecision {
	item: GearItem;
	status: GearStatus;
	/** Razón interpolada; null solo cuando no hay regla aplicable. */
	reason: string | null;
	priority: GearPriority | null;
	/** Id del ítem que este sustituye (este queda enabled). */
	replaces: string | null;
	/** Id del ítem que sustituye a este (este queda disabled). */
	replacedBy: string | null;
	source: GearDecisionSource;
}

/**
 * Material custom de mochila (SPECS_V3 §4). Lo define el usuario y vive en sus
 * datos locales, no en el catálogo de rutas. `attributes` es un vocabulario
 * cerrado para que las anti-reglas puedan razonar sobre él sin texto libre.
 */
export type GearAttribute =
	| 'impermeable'
	| 'abrigo'
	| 'ventilado'
	| 'aislante'
	| 'sol'
	| 'lluvia'
	| 'calzado'
	| 'tecnico';

export interface CustomGearItem {
	id: string;
	name: string;
	category: string;
	weight_g: number | null;
	attributes: GearAttribute[];
}

/**
 * Anti-regla de material custom: si un ítem tiene `attribute` y `when` se
 * cumple en el contexto (ruta + meteo), el ítem se desaconseja con `reason`.
 * Mismo lenguaje de condiciones que GearRule.when.
 */
export interface AttributeWarningRule {
	attribute: GearAttribute;
	when: Record<string, GearCondition>;
	reason: string;
}

export type CustomGearStatus = 'keep' | 'warn';

export interface CustomGearDecision {
	item: CustomGearItem;
	status: CustomGearStatus;
	/** Motivos del aviso (anti-reglas que saltaron); null si no se desaconseja. */
	reason: string | null;
}
