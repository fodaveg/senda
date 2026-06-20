/**
 * Relación ruta padre ↔ etapas (SPECS_V3 §6). Las grandes GR multi-día del
 * portal FEMECV se publican como una ruta "padre" (estado "Ver Etapas") más
 * una ruta por etapa con id `<padre>-e<NN>` (p. ej. `gr-10-e01`). Aquí se
 * deriva esa relación de los ids ya existentes —sin re-crawlear ni inventar
 * datos—. Módulo puro y testeable.
 */

const STAGE_RE = /^(.+)-e(\d+)$/;

/** Mínimo que necesita la derivación de cada ruta del catálogo. */
export interface StageSource {
	id: string;
	name: string;
}

export interface StageRef {
	id: string;
	/** Número de etapa (el NN del id). */
	order: number;
	name: string;
}

/** Id de la ruta padre si `id` es una etapa (`<padre>-e<NN>`), o null. */
export function parentIdOf(id: string): string | null {
	const m = STAGE_RE.exec(id);
	return m ? m[1] : null;
}

/** ¿Es `id` una etapa de otra ruta? */
export function isStage(id: string): boolean {
	return parentIdOf(id) !== null;
}

/**
 * Etapas de la ruta `parentId` presentes en el catálogo, ordenadas por número.
 * Si no hay ninguna, devuelve [].
 */
export function stagesOf(parentId: string, all: readonly StageSource[]): StageRef[] {
	const stages: StageRef[] = [];
	for (const r of all) {
		const m = STAGE_RE.exec(r.id);
		if (m && m[1] === parentId) stages.push({ id: r.id, order: Number(m[2]), name: r.name });
	}
	return stages.sort((a, b) => a.order - b.order);
}

/** Padre de la etapa `id` si existe en el catálogo; null si no es etapa o no está. */
export function parentOf(id: string, all: readonly StageSource[]): StageSource | null {
	const pid = parentIdOf(id);
	if (!pid) return null;
	return all.find((r) => r.id === pid) ?? null;
}
