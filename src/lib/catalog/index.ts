/**
 * API de lectura del catálogo (SPECS_V2 §4): resuelve almacén local
 * (catálogo actualizado en runtime) → seed empaquetado en build. Las
 * páginas consumen rutas a través de este módulo, nunca del seed directo.
 */

import { routes as seedRoutes, routeById as seedRouteById } from '$lib/data/routes';
import type { Route } from '$lib/types';
import { getStoredManifest, getStoredRoutesJson, type StoredManifest } from './store';

let cachedStored: { version: number; routes: Route[] } | null = null;

async function storedRoutes(): Promise<Route[] | null> {
	const manifest = await getStoredManifest();
	if (!manifest) return null;
	if (cachedStored && cachedStored.version === manifest.version) return cachedStored.routes;
	const json = await getStoredRoutesJson();
	if (!json) return null;
	try {
		// Validado con zod al descargar (update.ts); aquí solo se deserializa.
		const routes = JSON.parse(json) as Route[];
		cachedStored = { version: manifest.version, routes };
		return routes;
	} catch {
		return null;
	}
}

export async function getRoutes(): Promise<Route[]> {
	return (await storedRoutes()) ?? seedRoutes;
}

export async function getRouteById(id: string): Promise<Route | undefined> {
	const stored = await storedRoutes();
	if (stored) return stored.find((r) => r.id === id);
	return seedRouteById(id);
}

export interface CatalogInfo {
	/** null = catálogo integrado en la app (seed de build). */
	manifest: StoredManifest | null;
	routes: number;
}

export async function getCatalogInfo(): Promise<CatalogInfo> {
	const manifest = await getStoredManifest();
	const routes = await getRoutes();
	return { manifest, routes: routes.length };
}

/** Invalida la caché en memoria tras aplicar una actualización. */
export function resetCatalogCache(): void {
	cachedStored = null;
}
