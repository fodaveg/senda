# SPECS_V4 — Progreso y decisiones

Estado de la v4. Fuente de verdad para retomar. Mantener compacto.

_Rama: `v4` (rebasada sobre `main`, que ya incluye v3 + v3.5 + "Senda"). La v4 es
un "por si acaso": no se hace pública hasta que el proyecto demuestre ser estable
y útil. Se mergea a `main` por milestone validado (cada push a `main` publica)._

## Decisiones acordadas (2026-06-21)

- **Coste: el mínimo.** Backend = **Supabase Cloud plan GRATIS, región UE
  (Frankfurt)**, y solo se "enciende" cuando se decida. Hasta entonces, **0 €** y
  la app funciona 100% en local. Migrable a self-host en **Hetzner** (mejor valor
  EU) si algún día crece, sin reescribir (SDK aislado tras `src/lib/auth`).
- **Aislamiento de datos desde el día uno:** RLS "deny por defecto", una política
  `auth.uid() = user_id` por tabla (cada persona, incluido el dueño, solo ve lo
  suyo). Analítica **anónima** (sin user_id, solo-inserción, rankings por vista
  agregada). Ver `supabase/schema.sql`.
- **Alcance ahora: "base sin servidor"** (elección del usuario). Se construye la
  cimentación a coste 0 y sin tocar el modo local; auth/sync/analítica en vivo se
  dejan listos para activar.
- **i18n fuera de la v4.**
- **Licencias**: revisar (FEMECV / IGN CC-BY / OSM ODbL) **antes de publicar**; no
  bloquea el desarrollo. Anotado.

## V4-M1 — COMPLETO (refactor de datos A1+A2, sin backend, invisible)

A2 (fusión) ya estaba; A1 (repositorio) se ha completado en esta sesión:

- `src/lib/user/sync/merge.ts` (+ spec): fusión offline-first pura (LWW por
  elemento, tombstones, singleton) — el núcleo de la futura sincronización. **[A2]**
- `src/lib/user/repository.ts`: interfaz `UserDataRepository` (load/save por
  dominio + `subscribe`). `load`/`save` **síncronos** (offline-first). **[A1]**
- `src/lib/user/localRepository.ts` (+ spec): `LocalRepository`, el
  comportamiento de v3 detrás de la interfaz; `subscribe` vía evento `storage`.
- `src/lib/user/context.ts`: `provideUserRepository`/`getUserRepository` (contexto
  Svelte; fallback a un `LocalRepository` por defecto). El layout raíz lo provee.
- **Migrados los ~10 consumidores** (`+layout`, `RouteMarks`, `ThemeToggle`,
  `diario`, home, `ajustes`, `ruta/[id]`, `informe`, `emergencia`): ya no tocan
  localStorage directamente, usan `repo.*`.
- `src/lib/auth/types.ts`: contrato `AuthClient` + tipos de sesión/errores.
- `src/lib/config.ts`: lee `PUBLIC_SUPABASE_*`; sin env → backend deshabilitado.
- `supabase/schema.sql` + `README.md`: tablas + RLS + analítica anónima + pasos.

Verde: lint, check, **252 unit**, **46 e2e**, build OK.

## Pendiente (se hace al ACTIVAR el backend; necesita el proyecto Supabase free)

- Adaptador `AuthClient` real (Supabase) + store de sesión (§A3); añadir entonces
  `@supabase/supabase-js` (no antes, para no engordar el bundle).
- Añadir `updated_at`/tombstones a los esquemas locales (migración versionada),
  necesarios para que `merge.ts` opere sobre los datos reales (§A2/M4).
- `SyncedRepository` que use `merge.ts` contra Supabase; cola offline; indicador
  de sync (§B2). Se provee en el layout raíz cuando hay sesión.
- UI de cuentas/backoffice (§B1), migración de datos locales → cuenta (§A6).
- Analítica opt-in + vista de tendencias (§B3, §11).
- Preparación de escala (§B6): índice ligero + carga perezosa del catálogo +
  code-splitting del mapa. (UI de descubrimiento NO se rediseña hasta v5/v6.)

## Notas

- La rama `v4` parte de `v3` (que aún no está mergeada a main). Al mergear v3 a
  main, rebasar/mergear v4.
