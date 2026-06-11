/**
 * Cliente de actualización del catálogo (SPECS_V2 §4): descarga el
 * manifest publicado en GitLab Pages, compara versiones y baja los
 * ficheros de datos (rutas, equipo, fauna) validándolos con zod. Los GPX
 * no se descargan aquí: se cachean bajo demanda al visitar cada ruta.
 *
 * Puro y testeable: fetch inyectable, sin acceso directo al almacén.
 */

import { z } from 'zod';
import { routeSchema } from '$lib/data/schema';
import type { Route } from '$lib/types';
import type { StoredManifest } from './store';

/** Catálogo publicado por la CI del propio repo (GitLab Pages). */
export const DEFAULT_CATALOG_URL = 'https://fodaveg.gitlab.io/app-senderismo/catalog';

const manifestSchema = z.object({
	version: z.number().int().nonnegative(),
	published_at: z.string().min(1),
	files: z.record(z.string(), z.string())
});

export class CatalogError extends Error {}

export interface CatalogUpdate {
	manifest: StoredManifest;
	/** path → contenido, solo ficheros de datos (sin GPX). */
	entries: Record<string, string>;
	routes: Route[];
}

async function fetchText(baseUrl: string, path: string, fetchFn: typeof fetch): Promise<string> {
	const response = await fetchFn(`${baseUrl}/${path}`);
	if (!response.ok) {
		throw new CatalogError(`El catálogo respondió ${response.status} para ${path}`);
	}
	return response.text();
}

/**
 * null = ya estás en la última versión. Lanza CatalogError si el manifest
 * o algún fichero no valida: nunca se aplica un catálogo a medias.
 */
export async function checkForCatalogUpdate(
	baseUrl: string,
	current: StoredManifest | null,
	fetchFn: typeof fetch = fetch
): Promise<CatalogUpdate | null> {
	// Los errores de red se propagan tal cual (la UI los distingue de un
	// catálogo inválido); fetchText solo lanza CatalogError para HTTP != 2xx.
	const manifestText = await fetchText(baseUrl, 'manifest.json', fetchFn);
	let manifestRaw: unknown;
	try {
		manifestRaw = JSON.parse(manifestText);
	} catch {
		throw new CatalogError('manifest.json ilegible: no es JSON');
	}
	const parsed = manifestSchema.safeParse(manifestRaw);
	if (!parsed.success) {
		throw new CatalogError(`manifest.json no valida:\n${z.prettifyError(parsed.error)}`);
	}
	const manifest = parsed.data;
	if (current && manifest.version <= current.version) return null;

	const dataPaths = Object.keys(manifest.files).filter((p) => !p.startsWith('gpx/'));
	const entries: Record<string, string> = {};
	const routes: Route[] = [];
	for (const path of dataPaths) {
		const content = await fetchText(baseUrl, path, fetchFn);
		let json: unknown;
		try {
			json = JSON.parse(content);
		} catch {
			throw new CatalogError(`${path} no es JSON válido; catálogo rechazado entero`);
		}
		if (path.startsWith('routes/')) {
			const route = routeSchema.safeParse(json);
			if (!route.success) {
				throw new CatalogError(
					`${path} no valida; catálogo rechazado entero:\n${z.prettifyError(route.error)}`
				);
			}
			routes.push(route.data);
		}
		entries[path] = content;
	}
	if (routes.length === 0) {
		throw new CatalogError('El catálogo descargado no contiene ninguna ruta');
	}
	routes.sort((a, b) => a.id.localeCompare(b.id));
	return { manifest, entries, routes };
}
