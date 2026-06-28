/**
 * Multi-federación (V5-1): presets de capacidades por fuente y utilidades puras.
 *
 * Las "capacidades" indican qué categorías de datos publica la fuente oficial de
 * una ruta, para que la ficha muestre el dato o una **guarda** ("(Federación X)
 * no publica este dato"). Ver `RouteCapabilities` en `$lib/types`. Módulo puro,
 * sin Svelte: lo usan la ingesta, el catálogo y la UI.
 */

import type { RouteCapabilities } from '../types';

/** Todas las capacidades activas (FEMECV/CV: fuente rica, publica todo). */
export const FULL_CAPABILITIES: RouteCapabilities = {
	estado: true,
	mide: true,
	agua: true,
	etapas: true,
	descripcion: true,
	fauna: true,
	escapes: true
};

/** Ninguna capacidad (base para construir el preset de cada federación). */
export const NO_CAPABILITIES: RouteCapabilities = {
	estado: false,
	mide: false,
	agua: false,
	etapas: false,
	descripcion: false,
	fauna: false,
	escapes: false
};

/** Metadatos de una federación/fuente para la atribución y las capacidades. */
export interface FederationInfo {
	/** Código corto (clave en `Route.federacion`). */
	id: string;
	/** Nombre legible para la atribución ("(FNDME) no publica…"). */
	label: string;
	/** Comunidad autónoma. */
	comunidad: string;
	/** Qué publica públicamente esta fuente. */
	capabilities: RouteCapabilities;
}

/**
 * Registro de federaciones conocidas. Se amplía a medida que se integra cada
 * CCAA (V5-1). Las capacidades reflejan lo verificado en SPECS_V5_CCAA_ENDPOINTS.
 */
export const FEDERATIONS: Record<string, FederationInfo> = {
	FEMECV: {
		id: 'FEMECV',
		label: 'FEMECV',
		comunidad: 'Comunitat Valenciana',
		capabilities: FULL_CAPABILITIES
	},
	FNDME: {
		id: 'FNDME',
		label: 'FNDME',
		comunidad: 'Comunidad Foral de Navarra',
		// IDENA/MiSendaFEDME: estado (deportenavarra) + etapas; el resto no se
		// publica públicamente por ruta (ver PoC Navarra).
		capabilities: { ...NO_CAPABILITIES, estado: true, etapas: true }
	}
};

/** Info de una federación por id; FEMECV como fallback seguro. */
export function federationInfo(id: string | undefined): FederationInfo {
	return (id && FEDERATIONS[id]) || FEDERATIONS.FEMECV;
}

/**
 * Capacidades efectivas de una ruta: las explícitas si las trae; si no, las del
 * preset de su federación; si no, FULL (FEMECV/catálogo antiguo).
 */
export function routeCapabilities(route: {
	federacion?: string;
	capabilities?: RouteCapabilities;
}): RouteCapabilities {
	if (route.capabilities) return route.capabilities;
	return federationInfo(route.federacion).capabilities;
}
