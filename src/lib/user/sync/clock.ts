/**
 * Utilidades compartidas para los datos sincronizables (SPECS_V4 §A2): reloj
 * lógico (marca de tiempo) e identificadores estables. Puro, sin Svelte ni red.
 *
 * Las mutaciones de cada dominio (`marks`, `customGear`, …) reciben `now`/`id`
 * como parámetros opcionales con estos valores por defecto, de modo que los
 * tests puedan inyectar marcas de tiempo deterministas sin tocar el reloj real.
 */

/** Marca de tiempo lógica en ISO 8601 (UTC) para LWW. */
export function nowIso(): string {
	return new Date().toISOString();
}

/**
 * Identificador estable para un registro sincronizable. Usa `crypto.randomUUID`
 * cuando está disponible (navegador y Node ≥ 19); si no, un id razonablemente
 * único derivado de azar + tiempo (no se requiere unicidad criptográfica).
 */
export function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
