/**
 * Motor de reglas de mochila (SPEC.md §5). Función pura, sin dependencias de UI.
 *
 * Semántica:
 * - Condiciones de un `when` = AND. Operadores: gte, gt, lte, lt, eq, in.
 * - Varias reglas sobre el mismo ítem: gana la más específica (más pares
 *   clave-operador); empate → enable gana a disable (fail-safe).
 * - Si falta un dato (meteo offline o campo null), la regla no se puede
 *   evaluar: el ítem queda `indeterminate` salvo que una regla evaluable
 *   gane sin que ninguna no evaluable pudiera arrebatarle el resultado.
 *   Nunca se produce un falso "no lo lleves" por falta de datos.
 * - `replaces`: al habilitarse el ítem, deshabilita al sustituido y enlaza ambos.
 * - Ítems `base: true`: siempre enabled; las reglas no pueden deshabilitarlos.
 */

import type {
	AttributeWarningRule,
	CustomGearDecision,
	CustomGearItem,
	GearCondition,
	GearDecision,
	GearItem,
	GearRule,
	Route,
	Season,
	WeatherDay
} from '$lib/types';

interface Context {
	route: Route;
	weather: WeatherDay | null;
	season: Season;
}

type RuleOutcome = 'match' | 'nomatch' | 'unknown';

/**
 * Resuelve una clave de condición contra el contexto.
 * Devuelve undefined si el dato no está disponible (meteo ausente o campo null).
 */
function resolveContextValue(key: string, ctx: Context): unknown {
	if (key === 'season') return ctx.season;

	let value: unknown;
	let path: string[];
	if (key.startsWith('route.')) {
		value = ctx.route;
		path = key.split('.').slice(1);
	} else {
		if (ctx.weather === null) return undefined;
		value = ctx.weather;
		path = key.split('.');
	}

	for (const segment of path) {
		if (value === null || value === undefined) return undefined;
		if (segment === 'length' && (Array.isArray(value) || typeof value === 'string')) {
			return value.length;
		}
		if (typeof value !== 'object') return undefined;
		value = (value as Record<string, unknown>)[segment];
	}
	return value ?? undefined;
}

/** Evalúa un par operador/valor. Devuelve null si no es evaluable con ese tipo. */
function compare(op: string, actual: unknown, expected: unknown): boolean | null {
	switch (op) {
		case 'gte':
		case 'gt':
		case 'lte':
		case 'lt': {
			if (typeof actual !== 'number' || typeof expected !== 'number') return null;
			if (op === 'gte') return actual >= expected;
			if (op === 'gt') return actual > expected;
			if (op === 'lte') return actual <= expected;
			return actual < expected;
		}
		case 'eq':
			return actual === expected;
		case 'in':
			if (!Array.isArray(expected)) return null;
			return expected.includes(actual as never);
		default:
			return null;
	}
}

/** Número de pares clave-operador: medida de especificidad de la regla. */
function specificity(rule: GearRule): number {
	return Object.values(rule.when).reduce((n, cond) => n + Object.keys(cond).length, 0);
}

/**
 * Evalúa un bloque `when`. AND con lógica de tres valores:
 * cualquier condición falsa → nomatch (false AND desconocido = false);
 * si no, cualquier condición no evaluable → unknown; si no → match.
 */
function evaluateWhen(when: Record<string, GearCondition>, ctx: Context): RuleOutcome {
	let unknown = false;
	for (const [key, condition] of Object.entries(when)) {
		const actual = resolveContextValue(key, ctx);
		for (const [op, expected] of Object.entries(condition)) {
			const result = actual === undefined ? null : compare(op, actual, expected);
			if (result === false) return 'nomatch';
			if (result === null) unknown = true;
		}
	}
	return unknown ? 'unknown' : 'match';
}

function evaluateRule(rule: GearRule, ctx: Context): RuleOutcome {
	return evaluateWhen(rule.when, ctx);
}

/** Interpola {clave} con valores del contexto; deja el marcador si falta el dato. */
function interpolate(template: string, ctx: Context): string {
	return template.replace(/\{([\w.]+)\}/g, (marker, key: string) => {
		const value = resolveContextValue(key, ctx);
		return value === undefined ? marker : String(value);
	});
}

/** Entre las reglas que aplican, la más específica; empate → enable gana. */
function pickWinner(matched: GearRule[]): GearRule | null {
	if (matched.length === 0) return null;
	const top = Math.max(...matched.map(specificity));
	const finalists = matched.filter((r) => specificity(r) === top);
	return finalists.find((r) => r.action === 'enable') ?? finalists[0];
}

/**
 * ¿Alguna regla no evaluable podría cambiar el resultado del ganador?
 * Lo arrebataría con más especificidad, o con la misma si es enable
 * (porque en empate enable gana a disable).
 */
function isThreatened(winner: GearRule, unknowns: GearRule[]): boolean {
	const winnerSpec = specificity(winner);
	return unknowns.some(
		(u) =>
			u.action !== winner.action &&
			(specificity(u) > winnerSpec || (specificity(u) === winnerSpec && u.action === 'enable'))
	);
}

const REASON_NO_DATA = 'Sin datos suficientes (pronóstico no disponible) para decidir';

/**
 * Evalúa la mochila recomendada para una ruta, un día de pronóstico
 * (null si no hay conexión/pronóstico) y una estación.
 * Devuelve una decisión por cada ítem del catálogo, en el orden del catálogo.
 */
export function evaluateGear(
	route: Route,
	weather: WeatherDay | null,
	season: Season,
	items: GearItem[],
	rules: GearRule[]
): GearDecision[] {
	const ctx: Context = { route, weather, season };

	const decisions = new Map<string, GearDecision>();
	for (const item of items) {
		const itemRules = rules.filter((r) => r.item === item.id);
		const matched = itemRules.filter((r) => evaluateRule(r, ctx) === 'match');
		const unknowns = itemRules.filter((r) => evaluateRule(r, ctx) === 'unknown');
		const winner = pickWinner(matched);

		let decision: GearDecision;
		if (item.base) {
			// El equipo base siempre va en la mochila; una regla enable solo aporta matiz.
			const enabler = winner?.action === 'enable' ? winner : null;
			decision = {
				item,
				status: 'enabled',
				reason: enabler ? interpolate(enabler.reason, ctx) : 'Equipo base: siempre en la mochila',
				priority: enabler?.priority ?? null,
				replaces: enabler?.replaces ?? null,
				replacedBy: null,
				source: 'base'
			};
		} else if (winner && !isThreatened(winner, unknowns)) {
			decision = {
				item,
				status: winner.action === 'enable' ? 'enabled' : 'disabled',
				reason: interpolate(winner.reason, ctx),
				priority: winner.priority ?? null,
				replaces: winner.action === 'enable' ? (winner.replaces ?? null) : null,
				replacedBy: null,
				source: 'rule'
			};
		} else if (winner || unknowns.length > 0) {
			decision = {
				item,
				status: 'indeterminate',
				reason: REASON_NO_DATA,
				priority: null,
				replaces: null,
				replacedBy: null,
				source: 'rule'
			};
		} else {
			// Sin reglas aplicables: visible pero sin recomendación (decide el usuario).
			decision = {
				item,
				status: 'indeterminate',
				reason: null,
				priority: null,
				replaces: null,
				replacedBy: null,
				source: 'default'
			};
		}
		decisions.set(item.id, decision);
	}

	// Pasada de sustituciones: un ítem habilitado con `replaces` deshabilita
	// al sustituido (salvo equipo base) y enlaza ambos.
	for (const decision of decisions.values()) {
		if (decision.status !== 'enabled' || !decision.replaces) continue;
		const replaced = decisions.get(decision.replaces);
		if (!replaced || replaced.item.base) continue;
		replaced.status = 'disabled';
		replaced.reason = `Sustituido por ${decision.item.name}`;
		replaced.replacedBy = decision.item.id;
		replaced.source = 'replaced';
	}

	return items.map((item) => decisions.get(item.id)!);
}

/**
 * Evalúa el material custom del usuario (SPECS_V3 §4). Para cada ítem,
 * comprueba las anti-reglas cuyo `attribute` posee y cuyo `when` se cumple en
 * el contexto: si alguna salta, el ítem se desaconseja (`warn`) con sus
 * motivos; si ninguna salta (o faltan datos), se mantiene (`keep`).
 *
 * Fail-safe coherente con el motor base: con datos insuficientes (meteo
 * ausente → `when` no evaluable) NO se desaconseja, para no avisar a ciegas.
 * Función pura, sin dependencias de UI.
 */
export function evaluateCustomGear(
	route: Route,
	weather: WeatherDay | null,
	season: Season,
	items: CustomGearItem[],
	rules: AttributeWarningRule[]
): CustomGearDecision[] {
	const ctx: Context = { route, weather, season };
	return items.map((item) => {
		const warnings: string[] = [];
		for (const rule of rules) {
			if (!item.attributes.includes(rule.attribute)) continue;
			if (evaluateWhen(rule.when, ctx) === 'match') warnings.push(interpolate(rule.reason, ctx));
		}
		return {
			item,
			status: warnings.length > 0 ? 'warn' : 'keep',
			reason: warnings.length > 0 ? warnings.join(' · ') : null
		};
	});
}
