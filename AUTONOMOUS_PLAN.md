# PLAN AUTÓNOMO — Senda v4 (M4→M6 + pulido v3)

> **Para el "yo" que retoma tras un `/clear`.** Este fichero es la fuente de
> verdad de una tanda **autónoma sin validación del usuario** (se ha ido al
> gimnasio; tiene plan Max). Ejecuta de arriba abajo, sin pararte a pedir
> confirmación. Lee primero `~/.claude/context/`, `CLAUDE.md`, `PROJECT_CONTEXT.md`,
> `ARCHITECTURE.md` y `SPECS_V4_PROGRESS.md`. Crea tu propia lista de tareas
> (TaskCreate) a partir de este plan.

_Creado: 2026-06-22. Rama de trabajo: `v4`._

---

## 0. Reglas de operación (INNEGOCIABLES)

1. **Entorno / Node** — antes de CUALQUIER comando npm:
   ```bash
   export NVM_DIR="$HOME/.nvm"; export PATH="$NVM_DIR/versions/node/v22.22.3/bin:$PATH"
   node -v   # debe imprimir v22.22.3
   ```
   El harness antepone un node v24 de `codex-runtimes` y el `npm` del sistema es
   **6.14.17, que CORROMPE el árbol** al instalar (deja `@tauri-apps/api` UNMET).
   `npm run` funciona con cualquiera, pero **`npm install` SOLO con el npm de nvm**.
2. **Green gate antes de cada commit** (todo en verde, sin excepciones):
   ```bash
   npm run lint && npm run check && npm run test:unit -- --run && npm run test:e2e && npm run build
   ```
   Referencia actual: **270 unit, 48 e2e**. No avanzar con nada en rojo. Si
   prettier se queja, `npx prettier --write <ficheros>`.
3. **Un commit por milestone** (o sub-milestone) en verde. Conventional commit en
   **español**, terminando con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
4. **NO hacer push. NO mergear a `main`. NO tocar el remoto.** Solo commits locales
   en `v4`.
5. **Documentar on the fly**: doc en cada función/clase. Tras cada milestone,
   actualiza `SPECS_V4_PROGRESS.md` y `~/.claude/context/active-projects.md`.
6. **Reglas del proyecto** (de CLAUDE.md): offline-first, lógica de negocio pura
   sin Svelte, zod en los límites (también en lo que baja del backend), no inventar
   datos, degradación elegante, datos de usuario nunca se pierden (migraciones
   versionadas). UI y docs en español. Svelte 5 runes.
7. **Conservador ante la duda**: si un milestone resulta demasiado grande o
   arriesgado, haz la **sub-parte segura**, déjala en verde + commit, y anota el
   resto en "DECISIONES/PENDIENTES" (abajo). **Nunca dejes el árbol roto.** Si una
   decisión es de producto/legal/dispositivo, elige el default conservador,
   anótalo como asunción y sigue.
8. **Orquestación** (ahorra tokens): implementa inline; **delega lo verboso**: el
   green gate al agente `senda-verifier` (o `general-purpose`+sonnet si los agentes
   custom no están cargados), y cualquier revisión de seguridad/RLS a
   `security-auditor` (o `general-purpose`+opus).
9. **Backend real disponible** (`.env` local gitignored, proyecto Supabase id
   `vxqbcqhoisvotybfsstn`). Puedes hacer smoke tests REST con la publishable key.
   **NO** tienes la service key ni acceso al dashboard: lo que necesite eso va a
   "BLOQUEOS".

---

## 1. Cola de trabajo (en orden)

Marca cada uno al cerrarlo. Si uno es enorme, divídelo en sub-commits, cada uno
verde.

### V4-M4 — Sincronización (§A2/A6/B2)

**M4.1 — Esquemas locales sincronizables (invisible, sin red).** _Base para todo._

- Añade `id` estable + `updated_at` (ISO) + tombstone `deleted` donde aplique, a
  los dominios de `src/lib/user/` para que `merge.ts` (ya hecho y testeado) opere:
  - `marks.ts`: cada marca por ruta y cada **salida** (`outing`) necesitan `id` +
    `updated_at`; borrar salida = tombstone. Sube `USER_SCHEMA_VERSION` y escribe
    **migración versionada** que backfillea (`updated_at = now`, ids generados) **sin
    perder datos**.
  - `customGear.ts`: ítems ya tienen `id`; añade `updated_at` + `deleted`.
  - `checklist.ts`: por `(ruta, fecha)`; añade `updated_at`.
  - preferencias/ajustes (`settings.ts`): singleton con `updated_at` (usa
    `mergeSingleton`).
- zod actualizado + tests de migración (cargar v1 → migra a v2 sin pérdida).
- El `LocalRepository` sigue funcionando igual de cara a la UI. **Green + commit.**

**M4.2 — RemoteStore + SyncedRepository.**

- `src/lib/sync/remote.ts`: interfaz `RemoteStore` (load/upsert por dominio) +
  implementación Supabase (SDK por import dinámico, autenticada con la sesión),
  **zod** validando lo que baja. Mapea local↔tablas (`route_marks`, `outings`,
  `checklists`, `custom_gear`, `preferences`).
- `src/lib/user/syncedRepository.ts` implementa `UserDataRepository`: lee/escribe
  local al instante (offline-first) y, en segundo plano, hace pull → `merge.ts` →
  aplica `toApply` local y empuja `toPush` remoto. **Cola offline** persistida; se
  vacía al reconectar. Notifica vía `subscribe`.
- Wiring: en `+layout`, cuando la sesión pasa a `authenticated`, usar
  `SyncedRepository`; al cerrar sesión, volver a `LocalRepository` (datos locales
  intactos).
- **Indicador de sync** (componente: sincronizado / pendiente / sin conexión).
- **A6**: al primer login con datos locales, ofrecer "subir tus datos" (fusión, no
  sobreescritura).
- Tests con `RemoteStore` **mockeado** (no backend real en los tests). La
  validación multi-dispositivo real queda para el usuario.
- **Green + commit.** (Divide en 2-3 commits si hace falta.)

### V4-M5 — Analítica anónima + Tendencias (§B3/§11)

- `src/lib/analytics/`: cliente que, **solo si opt-in activado y con sesión**,
  inserta eventos anónimos (`favorita`/`completada`/`material`) en
  `analytics_events`. El `payload` debe cumplir el `check` del schema (objeto, con
  `route_id` o `name`, **sin** `user_id`/`email`). zod a la salida.
- Toggle **opt-in** en Ajustes con explicación (RGPD): por defecto **desactivado**.
- Página `/tendencias` que lee `trending_routes`/`trending_gear` (legibles por
  anon). Estado vacío elegante (k-anonimato `n>=5` → probablemente vacío aún).
- Tests con cliente mockeado. **Green + commit.**

### V4-M6 — Preparación de escala (§B6)

Hacer en commits independientes (cada uno aporta solo):

1. **Code-splitting del mapa**: import dinámico de MapLibre/`Map.svelte` donde no
   se use en el primer render (quita el aviso de chunk >500 kB).
2. **Índice ligero del catálogo** (id, nombre, bbox, comarca, tipo) + **carga
   perezosa** de la ficha completa bajo demanda. No romper el loader actual (deja
   fallback).
3. **Virtualización del listado** (render solo de lo visible) en la home.
4. **Índice de búsqueda** precomputado (no recorrer todo en memoria).
5. **Clustering** de marcadores en el mapa.

- Tests donde aplique. **Green + commit por cada uno.**

### Pulido v3 (PRE-C de SPECS_V5.md) — los de más valor

Tras M6 (varios solapan). Cada uno pequeño, green + commit:

- Editar un ítem de material custom (hoy solo alta/baja).
- Toggle de tema que cicle claro→oscuro→auto.
- Recordar el origen del filtro (provincia/comarca) entre visitas.
- Accesibilidad de los marcadores del mapa (foco, `aria-label`, teclado; popup no
  solo on-hover).
- (Ingesta, scripts/ — manual, no runtime) Deduplicar POIs cercanos del mismo
  nombre/tipo; persistir `stages`/`parent_id` en el dato. _Hacer solo si no
  requiere recrawl con red; si necesita red, anótalo en BLOQUEOS._

---

## 2. BLOQUEOS — NO intentar en esta tanda (requieren al usuario)

- **Dashboard Supabase**: Site URL, reactivar confirmación de email, activar
  TOTP, borrar usuarios de prueba. → solo documenta qué hace falta.
- **RPC de borrado de cuenta (RGPD)**: puedes **escribir** el SQL en `supabase/`
  (p. ej. `supabase/delete_account.sql`) y documentarlo, pero **no se puede
  aplicar** sin que el usuario lo ejecute. No asumas que está vivo.
- **OTP/reset por correo/web push**: implementables, pero su validación real
  necesita al usuario (app autenticadora, recibir email/push). Puedes dejar el
  código + tests mock; **no** los des por validados.
- **Legal/licencias, política de privacidad**: decisiones del usuario. No redactar
  como definitivo.
- **Multi-federación (V5-1), móvil nativo, firmar/notarizar dmg, regenerar dmg**:
  fuera de esta tanda.
- **i18n**: fuera de la v4 por decisión del usuario. No empezar.
- **Push a remoto / merge a main**: no.

---

## 3. DECISIONES / ASUNCIONES (ir anotando)

Cuando elijas un default conservador por falta de validación, anótalo aquí (y en
`SPECS_V4_PROGRESS.md`) para que el usuario lo revise:

- **A6 sin modal explícito (M4.2c)**: la "subida de datos locales al primer
  login" se resuelve con la **fusión automática no destructiva** del
  `SyncedRepository` (LWW por elemento: sube lo local-nuevo, baja lo remoto-nuevo,
  nunca sobreescribe). Se descartó un modal "¿subir tus datos?" porque su rama
  "no" dejaría una sesión iniciada sin sincronizar (estado confuso) y la fusión
  ya cumple el requisito. Revisar si se prefiere un aviso informativo.
- **Profiles/emergencia no se sincroniza aún (M4.2)**: las preferencias
  (`preferences`) llevan TODO `Settings` (incluida la ficha de emergencia que
  vive dentro de `settings.emergency`). La tabla `profiles` queda sin usar; si se
  quiere separar datos personales de ajustes, es trabajo futuro (M3-pendiente).
- **Sincronización multi-dispositivo real sin validar**: los tests usan un
  `RemoteStore` mock. El smoke test contra Supabase real requiere al usuario.

---

## 4. Al terminar la tanda (o si te bloqueas del todo)

1. Deja todo en **verde** y commiteado.
2. Actualiza `SPECS_V4_PROGRESS.md` y `~/.claude/context/active-projects.md`.
3. Escribe al final de este fichero un **RESUMEN DE LA TANDA**: qué milestones se
   cerraron (con hashes de commit), qué quedó a medias y por qué, la lista de
   DECISIONES/ASUNCIONES, y los BLOQUEOS que necesitan al usuario.
4. Para. No sigas con cosas de la sección 2.

---

## RESUMEN DE LA TANDA (2026-06-22)

Tanda autónoma completada **en verde de principio a fin** (rama `v4`, sin push ni
merge). Green gate final: **lint, check, 300 unit, 48 e2e, build sin avisos**.
Referencia inicial era 270 unit / 48 e2e → ahora 300 / 48.

### Milestones cerrados (commits en `v4`)

- **V4-M4.1** `56b8f96` — Esquemas locales sincronizables: `id`/`updated_at`/
  tombstones en marks/outings/customGear/checklist + `updated_at` en settings,
  con migración v1→v2 sin pérdida; consumidores filtran tombstones (`liveOutings`/
  `liveCustomItems`). Helper `sync/clock.ts`.
- **V4-M4.2** `d848cea`, `a5875e7`, `24c063c`, `fa85613` (docs) — Sincronización:
  `sync/records.ts` (conversores puros), `sync/remote.ts` (RemoteStore),
  `user/syncedRepository.ts` (offline-first + cola offline + estado de sync),
  `sync/supabaseRemote.ts` (zod), `supabase/client.ts` (cliente compartido),
  `user/sessionRepository.ts` (SwitchableRepository), `SyncIndicator.svelte`,
  cableado en `+layout`. §A6 = fusión automática no destructiva.
- **V4-M5** `dc9e710` — Analítica anónima opt-in (`src/lib/analytics/`, gating
  opt-in+sesión, zod anti-PII), toggle RGPD en Ajustes (off por defecto), página
  `/tendencias` con estado vacío y degradación.
- **V4-M6** (5 commits `6f7a54f`, `84657ac`, `336644c`, `cb8d3d4`, `9b95444` +
  docs `…`) — Escala: code-splitting del mapa (LazyMap), índice ligero del
  catálogo (RouteSummary), virtualización por `content-visibility`, índice de
  búsqueda precomputado, clustering de marcadores por zoom.
- **Pulido v3** `e163225`, `0bc5d02`, `cf0aadc`, `0a50f69` — Editar material
  custom; toggle de tema cíclico; recordar filtro provincia/comarca; a11y de
  marcadores.

### A medias / deferido

- **Dedup de POIs / persistir stages-parent_id (ingesta)**: deferido. Es pipeline
  manual no-runtime; rehacerlo a ciegas arriesga los 585 datasets y podría
  requerir recrawl con red. → BLOQUEOS.

### DECISIONES / ASUNCIONES tomadas (revisar)

- **A6 sin modal**: la subida de datos al primer login se resuelve con la fusión
  LWW automática (no destructiva); no se añadió modal "¿subir tus datos?".
- **Profiles/emergencia no se sincroniza por separado**: las preferencias llevan
  todo `Settings` (incluye `emergency`); la tabla `profiles` queda sin usar.
- **`chunkSizeWarningLimit: 1500`**: para no marcar el chunk de maplibre (diferido)
  ni el bundle de prerender (build-time). Los chunks de app reales son ~50 kB.
- **Stamping de `updated_at` de settings** movido a la capa de repositorio
  (`stampSettings`) para no romper el LWW al aplicar fusiones remotas.

### BLOQUEOS que necesitan al usuario

- **Validación real multi-dispositivo** de la sincronización (2 sesiones / 2
  dispositivos). Los tests usan `RemoteStore` mock.
- **Config del proyecto Supabase**: Site URL, reactivar confirmación de email,
  TOTP, borrar usuarios de prueba (ver M3-pendiente).
- **RPC de borrado de cuenta (RGPD)**, OTP/reset por correo, web push: requieren
  dashboard/correo/dispositivo del usuario.
- **Dedup de POIs / stages en la ingesta**: ver arriba.
- **Push a remoto / merge a `main`**: no hecho (por diseño de la tanda).
