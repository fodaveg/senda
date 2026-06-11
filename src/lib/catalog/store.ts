/**
 * Almacén local del catálogo (SPECS_V2 §4): IndexedDB, disponible tanto en
 * navegadores/PWA como en los webviews de Tauri (un único camino de código;
 * el FS de Tauri no hace falta). En SSR/prerender no hay IndexedDB y todo
 * devuelve null: la app cae al seed empaquetado.
 */

const DB_NAME = 'senderos-cv-catalog';
const DB_VERSION = 1;
const FILES = 'files';
const META = 'meta';

export interface StoredManifest {
	version: number;
	published_at: string;
	/** path relativo → checksum sha256 (hex). */
	files: Record<string, string>;
}

function openDb(): Promise<IDBDatabase> | null {
	if (typeof indexedDB === 'undefined') return null;
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
			if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB no disponible'));
	});
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('Error de IndexedDB'));
	});
}

async function readKey<T>(storeName: string, key: string): Promise<T | null> {
	const dbPromise = openDb();
	if (!dbPromise) return null;
	try {
		const db = await dbPromise;
		try {
			const tx = db.transaction(storeName, 'readonly');
			const value = await requestToPromise(tx.objectStore(storeName).get(key));
			return (value as T) ?? null;
		} finally {
			db.close();
		}
	} catch {
		// Almacén inaccesible (modo privado, cuota…): la app funciona con el seed.
		return null;
	}
}

export async function getStoredManifest(): Promise<StoredManifest | null> {
	return readKey<StoredManifest>(META, 'manifest');
}

/** Índice consolidado de rutas del catálogo descargado (JSON serializado). */
export async function getStoredRoutesJson(): Promise<string | null> {
	return readKey<string>(META, 'routes-index');
}

export async function getStoredFile(path: string): Promise<string | null> {
	return readKey<string>(FILES, path);
}

export async function getStoredTrack(gpxFile: string): Promise<string | null> {
	return getStoredFile(`gpx/${gpxFile}`);
}

/** Lectura binaria (tiles del mapa offline). */
export async function getStoredBinary(path: string): Promise<ArrayBuffer | null> {
	return readKey<ArrayBuffer>(FILES, path);
}

/** Guarda un binario (tile); los errores de cuota no rompen nada. */
export async function storeBinary(path: string, content: ArrayBuffer): Promise<void> {
	const dbPromise = openDb();
	if (!dbPromise) return;
	try {
		const db = await dbPromise;
		try {
			const tx = db.transaction(FILES, 'readwrite');
			tx.objectStore(FILES).put(content, path);
			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error ?? new Error('Error de IndexedDB'));
			});
		} finally {
			db.close();
		}
	} catch {
		// Solo una optimización.
	}
}

/** Borra todas las claves con un prefijo (p. ej. tiles de una ruta). */
export async function deleteByPrefix(prefix: string): Promise<number> {
	const dbPromise = openDb();
	if (!dbPromise) return 0;
	const db = await dbPromise;
	try {
		const tx = db.transaction(FILES, 'readwrite');
		const store = tx.objectStore(FILES);
		const keys = await requestToPromise(store.getAllKeys());
		let deleted = 0;
		for (const key of keys) {
			if (typeof key === 'string' && key.startsWith(prefix)) {
				store.delete(key);
				deleted++;
			}
		}
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error('Error de IndexedDB'));
		});
		return deleted;
	} finally {
		db.close();
	}
}

/** Guarda un fichero suelto (p. ej. un GPX cacheado bajo demanda). */
export async function storeFile(path: string, content: string): Promise<void> {
	const dbPromise = openDb();
	if (!dbPromise) return;
	try {
		const db = await dbPromise;
		try {
			const tx = db.transaction(FILES, 'readwrite');
			tx.objectStore(FILES).put(content, path);
			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error ?? new Error('Error de IndexedDB'));
			});
		} finally {
			db.close();
		}
	} catch {
		// Cachear es solo una optimización.
	}
}

/**
 * Aplica una actualización completa de catálogo de forma atómica: ficheros
 * nuevos, manifest y el índice de rutas en una sola transacción. Los GPX
 * cacheados de versiones anteriores se conservan solo si su checksum sigue
 * en el manifest.
 */
export async function applyCatalogUpdate(
	manifest: StoredManifest,
	entries: Record<string, string>,
	routesIndexJson: string
): Promise<void> {
	const dbPromise = openDb();
	if (!dbPromise) throw new Error('Almacén local no disponible en este entorno');
	const db = await dbPromise;
	try {
		const tx = db.transaction([FILES, META], 'readwrite');
		const files = tx.objectStore(FILES);
		const previousKeys = await requestToPromise(files.getAllKeys());
		for (const key of previousKeys) {
			// Los tiles del mapa offline no forman parte del catálogo publicado.
			if (typeof key === 'string' && !key.startsWith('tiles/') && !(key in manifest.files)) {
				files.delete(key);
			}
		}
		for (const [path, content] of Object.entries(entries)) files.put(content, path);
		const meta = tx.objectStore(META);
		meta.put(manifest, 'manifest');
		meta.put(routesIndexJson, 'routes-index');
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error('Error guardando el catálogo'));
		});
	} finally {
		db.close();
	}
}
