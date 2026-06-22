/**
 * Inyección del repositorio de datos de usuario vía contexto Svelte
 * (SPECS_V4 §A1). El layout raíz provee una instancia con
 * `provideUserRepository()`; cualquier componente la obtiene con
 * `getUserRepository()`. Así, cuando llegue la cuenta, basta proveer un
 * `SyncedRepository` en la raíz para que toda la app sincronice, sin cambiar los
 * componentes.
 *
 * Si no hay proveedor (un componente fuera del layout, un test, SSR), se
 * devuelve un `LocalRepository` por defecto compartido: la app sigue funcionando
 * en modo local exactamente como en v3.
 */

import { getContext, setContext } from 'svelte';
import type { UserDataRepository } from './repository';
import { LocalRepository } from './localRepository';

const KEY = Symbol('user-repository');

/** Repositorio local compartido para usos sin proveedor de contexto. */
let fallback: UserDataRepository | null = null;

function defaultRepository(): UserDataRepository {
	if (!fallback) fallback = new LocalRepository();
	return fallback;
}

/**
 * Registra el repositorio en el contexto del árbol de componentes actual.
 * Debe llamarse durante la inicialización de un componente (p. ej. el layout
 * raíz). Devuelve la instancia para poder usarla en el mismo componente.
 */
export function provideUserRepository(
	repo: UserDataRepository = new LocalRepository()
): UserDataRepository {
	setContext(KEY, repo);
	return repo;
}

/**
 * Obtiene el repositorio del contexto, o el local por defecto si no hay
 * proveedor. Llamar durante la inicialización del componente y guardar la
 * referencia para usarla en manejadores y efectos.
 */
export function getUserRepository(): UserDataRepository {
	return getContext<UserDataRepository | undefined>(KEY) ?? defaultRepository();
}
