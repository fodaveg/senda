/**
 * Provincia de la Comunitat Valenciana a partir de la comarca (`route.zone`)
 * de la ficha FEMECV (SPECS_V3 §3 y §7). Es una derivación determinista —no
 * un dato inventado—: cada comarca pertenece a una sola provincia. Permite el
 * filtro por provincia sin tener que re-crawlear el catálogo.
 *
 * Módulo puro y testeable.
 */

export type Province = 'alicante' | 'castellon' | 'valencia';

export interface ProvinceOption {
	id: Province;
	label: string;
}

/** Provincias para poblar el selector de filtro (en orden geográfico N→S). */
export const PROVINCES: ProvinceOption[] = [
	{ id: 'castellon', label: 'Castellón' },
	{ id: 'valencia', label: 'Valencia' },
	{ id: 'alicante', label: 'Alicante' }
];

/**
 * Comarca (clave kebab-case de `route.zone`) → provincia. La lista cubre las
 * comarcas presentes en el catálogo FEMECV; una comarca desconocida devuelve
 * null (no se adivina).
 */
const COMARCA_PROVINCE: Record<string, Province> = {
	// Castellón
	'alt-maestrat': 'castellon',
	'baix-maestrat': 'castellon',
	ports: 'castellon',
	alcalaten: 'castellon',
	'plana-alta': 'castellon',
	'plana-baixa': 'castellon',
	'alto-mijares': 'castellon',
	'alto-palancia': 'castellon',
	// Valencia
	'camp-de-morvedre': 'valencia',
	'camp-de-turia': 'valencia',
	'canal-de-navarres': 'valencia',
	costera: 'valencia',
	'horta-nord': 'valencia',
	'horta-sud': 'valencia',
	'hoya-de-bunol': 'valencia',
	'requena-utiel': 'valencia',
	'ribera-alta': 'valencia',
	'ribera-baixa': 'valencia',
	'rincon-de-ademuz': 'valencia',
	safor: 'valencia',
	serranos: 'valencia',
	'vall-d-albaida': 'valencia',
	'valle-de-ayora': 'valencia',
	valencia: 'valencia',
	// Alicante
	alacanti: 'alicante',
	alcoia: 'alicante',
	'alt-vinalopo': 'alicante',
	'baix-segura-vega-baja': 'alicante',
	'baix-vinalopo': 'alicante',
	comtat: 'alicante',
	'marina-alta': 'alicante',
	'marina-baixa': 'alicante',
	'vinalopo-mitja': 'alicante'
};

/** Provincia de una comarca, o null si la comarca es desconocida o ausente. */
export function provinceOf(zone: string | null): Province | null {
	if (!zone) return null;
	return COMARCA_PROVINCE[zone] ?? null;
}
