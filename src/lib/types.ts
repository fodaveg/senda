/**
 * Tipos compartidos del proyecto (SPEC.md §3–§5).
 * Este módulo es puro: sin imports de Svelte ni de UI.
 */

// ─── Rutas (SPEC §3) ────────────────────────────────────────────────────────

export type RouteType = 'GR' | 'PR' | 'SL';

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
export interface Route {
	id: string;
	name: string;
	type: RouteType;
	status: string;
	/** Clave de data/wildlife/zones.json. */
	zone: string | null;
	start: RouteStart;
	distance_km: number;
	ascent_m: number | null;
	descent_m: number | null;
	circular: boolean | null;
	difficulty_mide: DifficultyMide | null;
	est_duration_min: number | null;
	water_points: string[];
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
	sources: string[];
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
