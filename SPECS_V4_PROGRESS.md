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

## V4-M2 — CASI COMPLETO (backend y auth: A3, A4, A5)

El usuario creó el proyecto Supabase free (UE/Frankfurt, id `vxqbcqhoisvotybfsstn`),
ejecutó `schema.sql` sin errores y pasó la `anon/publishable key`. Smoke test REST
OK (vista pública legible, tablas protegidas devuelven vacío a anónimos, Auth
health 200). Falta solo validar un **login interactivo real** (crea usuario en su
proyecto → mejor en M3 con la UI, o un usuario de prueba puntual).

- **A5 — Esquema endurecido y auditado** (`supabase/schema.sql`): tras auditoría
  de seguridad (opus) se corrigieron, antes de ir a producción: vista con
  `security_invoker = off` explícito + `grant select` a anon/authenticated (los
  rankings no eran legibles); **k-anonimato** `having n >= 5` (evita
  reidentificación, §11); `check` de forma del `payload` anti-PII; `grant` de
  tabla y de secuencia para `authenticated`; `drop ... if exists` en políticas y
  constraints → script **re-ejecutable**; índice de agregación; vista
  `trending_gear`. RLS por usuario y solo-inserción de analytics ya estaban bien.
- **A4 — Config** (`src/lib/config.ts`): lee `PUBLIC_SUPABASE_*` (dynamic env);
  sin claves → modo local. Las claves viven en `.env` local (gitignored) y, en CI,
  como variables; nunca en el repo.
- **A3 — HECHO**: `@supabase/supabase-js` instalado y cargado por **import
  dinámico** (code-split: no entra en el bundle inicial). Implementado:
  - `src/lib/auth/supabaseAuth.ts`: adaptador `AuthClient` (signUp/signIn/signOut/
    currentSession/requestPasswordReset/verifyOtp), mapeo de sesión y errores
    **tipados** (`invalid_credentials`/`email_taken`/`rate_limit`/`network`).
  - `src/lib/auth/session.ts`: store de sesión Svelte (loading/anonymous/
    authenticated) con degradación elegante (sin red → anónimo).
  - `src/lib/auth/context.ts`: `provideAuth`/`getAuth` (contexto Svelte);
    deshabilitado si no hay backend.
  - Tests con SDK y cliente mockeados (16 nuevos). Green gate: lint, check,
    **268 unit**, **46 e2e**, build OK.
  - Pendiente menor: refinar firma `verifyOtp(email, code)` y `signUp` → `Session
| null` (confirmación por correo) ya aplicado en `types.ts`.

⚠️ **Entorno**: usar **npm de nvm** (`nvm use 22`, npm 10+). El npm del sistema es
6.14.17 y **corrompe el árbol** al instalar (deja `@tauri-apps/api` UNMET). `npm
run` funciona con cualquiera, pero `npm install` NO con el del sistema.

## V4-M3 — CASI COMPLETO (cuentas/UI: B1, B5)

- `provideAuth` cableado en `+layout`: inicializa la sesión persistida al arrancar
  (sin red → anónima). `AccountNav` en la cabecera (Entrar / Cuenta), solo si hay
  backend.
- `src/lib/components/AccountPanel.svelte`: login / crear cuenta / recuperar
  contraseña + backoffice (email, cerrar sesión, cambiar contraseña). Errores del
  backend traducidos a **español** por `AuthError.kind`.
- `src/routes/cuenta/+page.svelte`: si no hay backend, lo dice (la app sigue 100%
  local); si lo hay, monta el panel.
- `updatePassword` añadido a `AuthClient` + adaptador.
- **e2e con GoTrue simulado** (`tests/account.e2e.ts`, page.route sobre
  `**/auth/v1/**`): login feliz → backoffice; credenciales inválidas → error en
  español. No toca el backend real.
- Verificado: `$env/dynamic/public` SÍ funciona en adapter-static (las vars van a
  `build/_app/env.js`), así que el backend queda habilitado en producción.

Verde: lint, check, **269 unit**, **48 e2e**, build OK.

**Pendiente de M3 (a completar)**: OTP/TOTP; **borrar cuenta** (RGPD) requiere
función de servidor/RPC (el cliente no puede borrar su propio usuario de
`auth.users`); exportar cuenta; datos personales de emergencia sincronizados;
flujo de "restablecer contraseña" desde el enlace del correo (deep-link/ruta de
callback). **Validar un login interactivo real** (crea usuario en el proyecto).

## V4-M3 — COMPLETADO el resto (2026-06-27, backend validado en vivo)

Tras validar la sincronización en vivo (login real + RLS + sync OK), se cerró lo
que quedaba de M3, todo con tests mock (el correo real lo valida el usuario):

- **Borrar cuenta (RGPD)**: `AuthClient.deleteAccount` → RPC `delete_account`
  (SQL en `supabase/delete_account.sql`, security definer; pendiente de ejecutar
  en el proyecto) + cierre de sesión; UI con confirmación en dos pasos en el
  backoffice; degradación elegante si la RPC no está desplegada.
- **Restablecer contraseña por enlace de correo**: `AuthClient.onAuthEvent`
  (traduce `onAuthStateChange`), `requestPasswordReset` con `redirectTo=/cuenta`,
  estado `recovery` en el store y formulario de nueva contraseña en `AccountPanel`.
- **OTP (código por correo)**: `requestOtp`/`verifyOtp` + modo "Recibir un código
  por email" en `AccountPanel` (requiere plantilla de email con `{{ .Token }}`).
- **Validado en vivo**: signup+signin reales, RLS, y la **sincronización
  multi-dispositivo** funcionan (el usuario lo confirmó). Falta solo validar el
  correo (confirmación/reset/OTP), que depende del proveedor de email.

## Arreglo: `npm run dev` (Vite 8 + service worker)

El módulo virtual `$service-worker` en dev con Vite 8 no exporta `base` (sí
`build`/`files`/`version`), así que `import { base }` rompía el SW y, en cascada,
la hidratación. Se deriva `base` de `import.meta.env.BASE_URL`. (En dev, un
adblocker puede bloquear `/src/lib/analytics/*` por el nombre → usar incógnito.)

## Pre-merge / pre-publicación — checklist (decisiones/acciones del usuario)

Antes de mergear `v4` a `main` (cada push a `main` publica) conviene:

1. **Backend Supabase**: ejecutar `supabase/delete_account.sql`; fijar **Site URL**
   y **Redirect URLs** al dominio real; **reactivar "Confirm email"**; (opcional)
   plantilla de email con `{{ .Token }}` para OTP y TOTP; borrar usuarios de prueba.
2. **Variables públicas en CI** (`PUBLIC_SUPABASE_URL`/`ANON_KEY`) si se quiere el
   backend activo en producción; sin ellas, la app sigue 100% local.
3. **Licencias / atribución** (decisión del usuario, no redactado como definitivo):
   consolidar atribución de **FEMECV**, **IGN (CC-BY)** y **OSM (ODbL)** —hoy está
   repartida (mapa=IGN; POIs/agua etiquetados "(OSM)"; enlaces FEMECV/Wikiloc)— en
   una página "Acerca de / Licencias", y revisar la **política de privacidad** y el
   consentimiento de analítica.
4. **Validar el correo** (confirmación/reset/OTP) con un email que no pre-escanee
   los enlaces.

## V4-M4.1 — COMPLETO (esquemas locales sincronizables, invisible, sin red)

Base para la sincronización: cada dominio de `src/lib/user/` lleva ya los campos
que `merge.ts` necesita (`id`/`updated_at`/tombstone `deleted`), con **migración
versionada que no pierde datos** y la UI funcionando igual.

- `src/lib/user/sync/clock.ts`: helpers compartidos `nowIso()` (marca de tiempo
  ISO para LWW) y `newId()` (`crypto.randomUUID` con fallback). Las mutaciones
  reciben `now`/`id` como parámetros opcionales (tests deterministas).
- `marks.ts` (**v2**): cada conjunto de marcas por ruta tiene `updated_at`
  (último toggle) y cada salida es un registro sincronizable (`id` +
  `updated_at` + `deleted`). **Borrar una salida es un tombstone** (no se elimina
  del array); `liveOutings()` filtra las vivas. `migrateUserData` backfillea ids
  y `updated_at` de v1. Consumidores actualizados: `RouteMarks.svelte` (borrado
  por id), `stats.ts`, `achievements.ts`.
- `customGear.ts` (**v2**): ítems con `updated_at` + tombstone `deleted`;
  `removeCustomItem` ahora es tombstone; `liveCustomItems()` filtra. Consumidores:
  ficha de ruta, informe y `ajustes` usan `liveCustomItems`. `migrateCustomGear`
  backfillea v1.
- `checklist.ts` (**v2**): cada entrada `(ruta, fecha)` es `{ items, updated_at }`;
  vaciar guarda lista vacía con `updated_at` (el desmarcado se propaga). Migra v1
  (`Record<key,string[]>`). API `Set<string>` intacta.
- `settings.ts`: singleton con `updated_at` (para `mergeSingleton`); `saveSettings`
  lo estampa en cada guardado; ajustes antiguos se backfillean a fecha cero
  (`EPOCH`) para que cualquier cambio/dato remoto real prevalezca.
- Tests de migración v1→v2 (marcas y material) sin pérdida + tombstones; specs
  existentes actualizadas al nuevo contrato. **El `LocalRepository` y la UI se
  comportan igual.**

Verde: lint, check, **272 unit**, **48 e2e**, build OK.

## V4-M4.2 — COMPLETO (RemoteStore + SyncedRepository + cableado, §B2/§A6)

Sincronización offline-first completa, con backend Supabase real disponible y
tests contra `RemoteStore` mockeado (la validación multi-dispositivo real queda
para el usuario). Tres sub-commits:

- **M4.2a (núcleo)**: `sync/records.ts` (conversores puros local↔registros por
  tabla, round-trips testeados), `sync/remote.ts` (interfaz `RemoteStore`),
  `user/syncedRepository.ts` (implementa `UserDataRepository`: local instantáneo
  - pull→`merge.ts`→aplica/empuja en segundo plano; **cola offline** persistida;
    estado synced/syncing/pending/offline; flush al evento `online`). El sellado de
    `updated_at` de ajustes se movió a la capa de repositorio (`stampSettings`)
    para no romper el LWW al aplicar fusiones remotas.
- **M4.2b (Supabase)**: `sync/supabaseRemote.ts` (mapea las 5 tablas, inyecta
  `user_id` desde la sesión, **zod** a lo que baja, errores propagados para
  reintentar). `supabase/client.ts`: cliente compartido (un solo GoTrue, misma
  sesión que auth). `coerceSettings()` como validación de límite reutilizada.
- **M4.2c (cableado)**: `user/sessionRepository.ts` (`SwitchableRepository`:
  instancia única provista por el layout, conmuta local↔sincronizado según la
  sesión). `SyncIndicator.svelte` en la cabecera. **§A6**: al primer login la
  fusión es automática y no destructiva (sube lo local, baja lo de otros
  dispositivos); no hay modal de "subir tus datos" porque la fusión LWW ya lo
  garantiza sin sobreescribir (ver DECISIONES).

Verde: lint, check, **282 unit**, **48 e2e**, build OK.

## V4-M5 — COMPLETO (analítica anónima opt-in + tendencias, §B3/§11)

- `src/lib/analytics/`: `types.ts` (contrato `AnalyticsClient`), `events.ts`
  (constructores puros `routeEvent`/`gearEvent` + `isValidEvent` con zod, espejo
  del `check` del servidor: objeto con `route_id` o `name`, **sin** PII),
  `supabaseAnalytics.ts` (insert en `analytics_events` + lectura de
  `trending_routes`/`trending_gear` con zod), `context.ts` (gating: solo envía
  con **opt-in + sesión** y evento válido; fire-and-forget, nunca rompe la UI).
- **Toggle opt-in en Ajustes** ("Privacidad y analítica"), **desactivado por
  defecto**, con explicación RGPD; solo visible si hay backend.
- Eventos disparados: favorita (al marcar), completada (al registrar salida) en
  `RouteMarks`; material (al añadir) en Ajustes.
- **Página `/tendencias`** (enlace en cabecera si hay backend): rankings con
  estado vacío elegante (k-anonimato `n>=5` → vacío hasta que haya uso) y
  degradación (sin backend / error). Nombres de ruta desde el catálogo.
- Tests con cliente mockeado (forma de eventos, anti-PII, gating). Añadido
  `analyticsOptIn` a `Settings` (sincroniza vía preferences).

Verde: lint, check, **289 unit**, **48 e2e**, build OK.

## V4-M6 — COMPLETO (preparación de escala, §B6) — 5 commits independientes

1. **Code-splitting del mapa**: `LazyMap.svelte` carga `Map.svelte`/maplibre por
   import dinámico → chunk asíncrono fuera del bundle inicial. `chunkSizeWarningLimit`
   subido a 1500 (vendor diferido + bundle de prerender, no código de arranque).
2. **Índice ligero del catálogo**: `RouteSummary` + `getRouteSummaries`; la home
   carga solo los campos del listado/mapa (menor payload de hidratación) y la ficha
   completa se carga bajo demanda. `search`/`filters` ahora genéricos sobre
   interfaces mínimas (operan sobre `Route` o `RouteSummary`).
3. **Virtualización del listado**: por `content-visibility: auto` +
   `contain-intrinsic-size` (el navegador omite render/layout de filas fuera de
   pantalla pero mantiene el DOM; no rompe búsqueda/anclas/scroll, a diferencia de
   sacar nodos del DOM).
4. **Índice de búsqueda precomputado**: `buildSearchIndex`/`searchIndex`; el
   `haystack` normalizado se calcula una vez, no por pulsación.
5. **Clustering de marcadores**: `map/cluster.ts` (rejilla por zoom, pura y
   testeada) + `Map.svelte` agrupa marcadores; grupo de 1 = pin normal, clúster =
   conteo (clic acerca y separa).

(UI de descubrimiento NO se rediseña hasta v5/v6.)

Verde: lint, check, **296 unit**, **48 e2e**, build sin aviso de chunk.

## Pulido v3 (PRE-C de SPECS_V5) — COMPLETO (4 de 5)

Cada uno un commit pequeño en verde:

- **Editar material custom**: `updateCustomItem` + modo edición en Ajustes.
- **Toggle de tema cíclico**: claro → oscuro → automático.
- **Recordar el filtro geográfico**: `discoverPrefs.ts` persiste provincia/comarca
  entre visitas.
- **A11y de marcadores del mapa**: foco + teclado (Enter/Espacio) + `aria-label`
  en pines y clústeres; popups de agua/POI/waypoint también con el foco (no solo
  hover); `outline` de foco visible.
- **(Deferido) Dedup de POIs / persistir stages-parent_id en la ingesta**: es
  pipeline manual (`scripts/`), no runtime; rehacerlo a ciegas arriesga corromper
  los 585 datasets y podría requerir recrawl. Anotado en BLOQUEOS del plan.

Verde: lint, check, **300 unit**, **48 e2e**, build OK.

## Pendiente

- Validación real multi-dispositivo de la sincronización (necesita 2 sesiones del
  usuario) y config del proyecto Supabase (ver M3-pendiente y BLOQUEOS).
- Dedup de POIs / stages en la ingesta (deferido, ver arriba).

## Notas

- La rama `v4` ya está **rebasada sobre `main`** (que incluye v3 + v3.5 +
  "Senda"). Se mergea a `main` por milestone validado.
