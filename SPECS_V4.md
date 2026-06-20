# SPECS V4 — Senderos CV

Especificación de la **versión 4**. Deltas sobre [SPEC.md](SPEC.md) (v1),
[SPECS_V2.md](SPECS_V2.md) (v2) y [SPECS_V3.md](SPECS_V3.md) (v3). Todo lo no
modificado aquí sigue vigente.

**Cambio fundacional de la v4:** introduce por primera vez un **backend**
(cuentas de usuario, sincronización y analítica). Esto **reabre la decisión
cerrada "sin backend"** de v1 §1; el resto de principios se mantienen.

**Principio rector:** la app sigue siendo **offline-first y estática en el
cliente** (PWA + Tauri, hosting estático en Pages). El backend es un **módulo
online que degrada con elegancia**: sin red o sin sesión, la app funciona en
local exactamente como en v3. La cuenta solo añade **sincronización entre
dispositivos** y **analítica anónima agregada**; nunca es obligatoria para usar
la app.

> El i18n queda **fuera de esta versión** por decisión del usuario.

---

## 1. Decisiones de arquitectura v4 (cerradas)

| Capa             | v3                                 | v4                                                                                          |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Backend          | Ninguno (estático)                 | **BaaS (Supabase recomendado, §10)**: Auth + Postgres + RLS. Frontend sigue estático        |
| Datos de usuario | localStorage versionado            | localStorage **+ sincronización opcional** a la cuenta (offline-first, fusión por elemento) |
| Identidad        | —                                  | Cuentas: registro, login, OTP opcional, recuperación, sesión persistente                    |
| Analítica        | Diseñada anonimizable, sin recoger | **Recogida anónima opt-in** → rankings públicos agregados                                   |
| Hosting          | GitLab Pages (web) + binarios      | + **servidor/BaaS** para el backend (§10). La web sigue en Pages                            |

**Restricciones que se mantienen (de v1–v3):**

- Frontend **offline-first**; el backend degrada (sin sesión/red = modo local).
- **No inventar datos**; zod en todos los límites (también en las respuestas del
  backend y en los datos sincronizados).
- Lógica de negocio **pura, sin imports de Svelte**; clientes online inyectables.
- Wikiloc nunca como fuente de datos.
- **Privacidad por diseño** (§11): la analítica es anónima, opt-in y agregada; sin
  vincular datos a personas; RGPD.

**Decisión pendiente del usuario:** proveedor/hosting concreto (§10). La spec
asume **Supabase** como referencia (la recomendación de v3); si se elige otro, el
diseño de §3–§6 es portable (Postgres + auth + reglas por fila).

---

# PARTE A — REFACTOR (habilitar las cuentas sin romper lo existente)

Objetivo: poder añadir cuentas y sincronización **sin reescribir** la app ni
perder el modo offline. Son cambios estructurales, no funcionalidad visible.

## A1. Capa de datos de usuario como repositorio

Hoy cada módulo de `src/lib/user/` (marcas, diario, checklist, material custom) y
`settings.ts`/apariencia leen y escriben **directamente** en localStorage. Para
sincronizar hace falta una **abstracción**:

- `src/lib/user/repository.ts`: interfaz `UserDataRepository` con operaciones por
  dominio (marks, outings, checklist, customGear, appearance) — _load / save /
  subscribe_.
- Dos implementaciones: **`LocalRepository`** (localStorage, lo actual) y
  **`SyncedRepository`** (local + remoto, cuando hay sesión).
- Los componentes pasan a usar el repositorio (inyectado vía contexto Svelte), no
  localStorage directamente. Migración mecánica, módulo a módulo, con tests.

**Sin esta capa, la sincronización se enredaría en cada componente.** Es el
refactor central de la v4.

## A2. Fusión offline-first (sync)

- **Modelo:** cada registro de usuario lleva `updated_at` (timestamp lógico) y un
  `id` estable. La fusión es **last-write-wins por elemento** (no por documento),
  para no perder cambios hechos en otro dispositivo.
- Casos: diario (lista de salidas → unión por id), marcas (por ruta, LWW),
  checklist (por ruta+fecha, LWW), material custom (por id, LWW + tombstones para
  borrados), apariencia/ajustes (LWW global).
- **Funciones de fusión puras y testeadas** (`src/lib/user/merge.ts`): entrada
  local + remoto → resultado + operaciones a subir. Sin red, sin Svelte.
- Cola de cambios pendientes cuando no hay red; se vacía al recuperar conexión.

## A3. Módulo de autenticación

- `src/lib/auth/`: cliente de auth inyectable (envoltorio del SDK del BaaS),
  estado de sesión como store de Svelte (`session`, `user`, `loading`).
- Operaciones: `signUp`, `signIn`, `signOut`, `requestPasswordReset`,
  `verifyOtp`, `refreshSession`. Errores tipados (credenciales, red, rate-limit).
- **Sesión persistente** ("mantener conectado") con refresco de token; en Tauri,
  almacenamiento seguro del refresh token (no en localStorage plano si se puede).

## A4. Configuración y secretos

- Variables públicas de build (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`)
  vía `$env/static/public`. Hoy solo se usa `BASE_PATH`; hay que introducir un
  módulo `src/lib/config.ts` y documentar las env en README/CI.
- Nada de secretos en el repo; la `anon key` es pública por diseño (la seguridad
  vive en las **políticas RLS**, no en ocultar la key).

## A5. Modelo de datos en el servidor (espejo de lo local)

Tablas Postgres con **RLS** (cada usuario solo ve y escribe sus filas):

```sql
-- una fila por (user, ruta)
route_marks(user_id, route_id, favorita, me_gusta, quiero_hacer, updated_at, ...)
-- salidas del diario (varias por ruta)
outings(id, user_id, route_id, date, notes, updated_at, deleted)
-- checklist por (ruta, fecha)
checklists(user_id, route_id, date, checked_ids[], updated_at)
-- material propio
custom_gear(id, user_id, name, category, weight_g, attributes[], updated_at, deleted)
-- preferencias (tema/esquemas/origen/mapa)
preferences(user_id, json, updated_at)
-- perfil/backoffice
profiles(user_id, display_name, personal_data jsonb, updated_at)
```

- El **esquema versionado** local ya existente se mapea 1:1; las migraciones de
  esquema se versionan también en el servidor.
- **Validación con zod** de todo lo que baja del servidor (no fiarse del backend).

## A6. Migración de datos locales → cuenta

- Al iniciar sesión por primera vez en un dispositivo con datos locales: ofrecer
  **"subir tus datos a la cuenta"** (fusión, no sobreescritura). Si rechaza, la
  cuenta empieza vacía y el local se conserva.
- Reversible: cerrar sesión deja los datos locales intactos.

## A7. Tres entornos (web, PWA, Tauri)

- Login funcional en los tres. En Tauri, el flujo OAuth/OTP por enlace de correo
  necesita deep-link (`ign://` ya registrado como protocolo, reutilizable) o
  pegado de código OTP.
- Tests: fusión y auth con cliente **mockeado**; e2e del flujo de login con un
  backend simulado (`page.route`).

---

# PARTE B — NUEVAS FEATURES

## B1. Cuentas de usuario (la petición)

- **Registro y login** (email + contraseña).
- **OTP opcional** para login reforzado: TOTP (app autenticadora) y/o código por
  correo. Configurable por el usuario en su backoffice.
- **Recuperación de contraseña** por correo.
- **"Mantener conectado"** (sesión persistente con refresco).
- **Backoffice de usuario**: cambiar contraseña, datos personales (los de
  emergencia de v2 §9 pasan a sincronizarse), gestionar OTP, **exportar y borrar
  la cuenta** (RGPD, §11).

## B2. Sincronización multi-dispositivo

- Marcas, diario/estadísticas, checklist, material custom, ajustes y **esquema de
  color** (v3) se sincronizan: empiezas en el móvil y sigues en el escritorio.
- Indicador de estado de sync (sincronizado / pendiente / sin conexión).

## B3. Analítica anónima y rankings (propuesta del usuario, ya prevista en v3 §10)

- Recogida **opt-in y anónima** de: rutas marcadas favoritas/completadas y
  material custom (nombre + atributos). **Sin vincular a la identidad** (eventos
  agregados, sin user_id reidentificable).
- Vista pública **"Tendencias"**: rutas más recorridas/favoritas, material más
  llevado. Sirve también para que el dueño decida qué material añadir al catálogo
  por defecto.
- Tabla `analytics_events` de solo-inserción; agregación en vistas materializadas.

## B4. Funcionalidad nueva propuesta (a valorar)

- **Avisos proactivos (web push)**: notificar al usuario si una ruta que tiene en
  "quiero hacer" cae en día de **aviso AEMET o riesgo de incendio alto** para una
  fecha que haya marcado. Requiere backend + Web Push (VAPID). _Alto valor de
  seguridad._
- **Partes de estado de ruta por la comunidad**: los usuarios reportan
  incidencias ("fuente seca", "puente cortado", "señalización perdida") con fecha;
  se muestran en la ficha con moderación y caducidad. Complementa el dato oficial
  FEMECV sin sustituirlo (se etiqueta "reporte de usuario, sin verificar").
- **Valoración propia y notas privadas** por ruta (además de las marcas), que
  alimentan el diario.
- **Planificador de salidas**: agenda con fecha objetivo por ruta; combina con la
  ventana de inicio (v2 §5), meteo y avisos; base para los push de B4.
- **Listas/colecciones** de rutas ("pendientes de verano", "con niños") y
  posibilidad de **compartir** una lista o el diario por enlace público opcional.
- **Material como plantillas**: guardar conjuntos de mochila reutilizables.

## B5. Usabilidad

- **Onboarding** breve la primera vez (qué es offline, qué añade la cuenta).
- **Estado de cuenta/sync** visible y no intrusivo; la app nunca bloquea por falta
  de login.
- **Gestión de cuenta** clara (exportar/borrar datos — RGPD) en el backoffice.
- **Instalación PWA** (prompt) y mejoras de accesibilidad pendientes del backlog
  de v3 (foco/teclado en marcadores del mapa).
- **Búsqueda mejorada**: ya hay buscador; con más rutas conviene resaltar
  coincidencias y filtrar por más campos (ver B6).

## B6. Rendimiento y escala (importante de cara a v5/v6)

Hoy el catálogo (~585 rutas) se **empaqueta entero** (`import.meta.glob`) y el
listado **renderiza todo**. Funciona ahora, pero **no escala** cuando entren
otras federaciones (miles de rutas, v5/v6). Mejoras propuestas:

- **Carga perezosa/paginada del catálogo**: no bundlear todas las rutas; servir un
  índice ligero (id, nombre, bbox, comarca, tipo) y cargar la ficha completa bajo
  demanda. El catálogo actualizable (v2 §4) ya da la vía.
- **Virtualización del listado** (render solo de lo visible).
- **Índice de búsqueda** precomputado (no recorrer todo en memoria).
- **Code-splitting**: carga diferida de MapLibre (pesa) donde no se use; ya hay
  aviso de chunks > 500 kB en el build.
- **Clustering** de marcadores en el mapa con muchas rutas/POIs.
- **Caché** de tiles y datos (parte ya hecho: tiles offline, deltas de catálogo).

> **Nota para v5/v6 (NO hacer ahora):** con varias federaciones el modelo "todas
> las rutas en memoria + un listado plano" se queda corto. Habrá que **rediseñar
> la UI de descubrimiento** (navegación por federación/territorio/mapa como
> entrada principal, búsqueda federada, filtros jerárquicos). Queda **anotado**
> como trabajo de la versión en que se añadan esas rutas; la v4 solo deja el
> terreno (índice ligero + carga perezosa) preparado.

---

## §10. Servidor recomendado (Hetzner vs OVH vs BaaS gestionado)

Contexto: usuarios en España → **RGPD y residencia de datos en la UE** son
requisito. El backend necesita Postgres + Auth (OTP, correo, recuperación) + envío
de email transaccional.

### Recomendación

1. **Para arrancar la v4: Supabase Cloud, región UE (Frankfurt).**
   - Trae **listo** lo que pide B1: Auth con OTP (TOTP y email), recuperación,
     sesiones/JWT, Postgres con RLS, y envío de correo. Cero operación de
     servidor.
   - Coste: plan gratis para empezar; **Pro ~25 $/mes** al crecer. Firma DPA y
     región UE para RGPD.
   - **Mejor relación esfuerzo/tiempo para validar la v4.**

2. **Cuando se quiera control/coste/residencia total: Supabase autohospedado en
   Hetzner.**
   - **Hetzner = mejor valor de cómputo en Europa** (datacenters en Alemania y
     Finlandia, RGPD nativo). Una **CX/CPX con ~8 GB RAM (~8–15 €/mes)** sostiene
     Supabase self-host (varios contenedores) con holgura; tráfico generoso
     incluido.
   - Implica operarlo tú: Docker Compose, **copias de seguridad**, actualizaciones
     y un servicio SMTP para los correos.

3. **Alternativa a Hetzner: OVHcloud (Francia).**
   - Precio similar en gama baja; ventaja si prefieres **jurisdicción francesa** o
     necesitas **certificaciones (HDS, SecNumCloud)**. Para este proyecto no son
     necesarias, así que Hetzner gana por **precio y simplicidad**.

4. **Opción mínima si se evita Supabase: PocketBase en un Hetzner CX pequeño
   (~4 €/mes, 4 GB).**
   - Un solo binario Go (auth + Postgres/SQLite + panel admin). Mucho más ligero y
     barato, pero **OTP/TOTP y algunas piezas hay que montarlas a mano**. Bueno si
     el alcance de cuentas se mantiene simple.

**Veredicto:** empezar en **Supabase Cloud (UE)** por velocidad; dejar el código
**portable a Supabase self-host en Hetzner** si el coste o la residencia de datos
lo justifican más adelante. Evitar lock-in usando SQL estándar y aislando el SDK
de auth tras el módulo `src/lib/auth/` (A3).

Fuentes: comparativas Hetzner/OVH 2026
([VPSBenchmarks](https://www.vpsbenchmarks.com/compare/hetzner_vs_ovhcloud),
[getdeploying](https://getdeploying.com/hetzner-vs-ovh),
[hostadvice](https://hostadvice.com/tools/web-hosting-comparison/hetzner-vs-ovhcloud/)).

---

## §11. Privacidad y RGPD (innegociable)

- **Cuenta**: base legal = ejecución del servicio; datos mínimos (email). Datos
  personales del backoffice, **opcionales**.
- **Analítica**: **opt-in explícito**, **anónima** (sin user_id reidentificable),
  agregada; el usuario puede desactivarla y seguir usando todo.
- **Derechos**: exportar y **borrar la cuenta** (y sus datos) desde el backoffice;
  borrado en cascada en el servidor.
- **Residencia**: backend en la **UE** (§10).
- **Política de privacidad** y aviso de cookies/almacenamiento accesibles.

---

## §12. Milestones v4

Como en v1–v3: cada milestone termina con tests en verde y un commit.

1. **V4-M1 — Refactor de datos (A1, A2)**: repositorio + fusión pura testeada,
   sin backend aún (sigue todo en local detrás de la interfaz). Sin cambio visible.
2. **V4-M2 — Backend y auth (A3, A4, A5)**: proyecto Supabase, tablas + RLS,
   módulo de auth, config de env.
3. **V4-M3 — Cuentas (B1)**: registro, login, recuperación, backoffice. OTP.
4. **V4-M4 — Sincronización (A6, B2)**: SyncedRepository, migración de datos
   locales, indicador de sync.
5. **V4-M5 — Analítica (B3, §11)**: recogida opt-in anónima + vista de tendencias.
6. **V4-M6 — Preparación de escala (B6, sin rediseño)**: índice ligero + carga
   perezosa del catálogo + code-splitting del mapa. (UI de descubrimiento NO se
   rediseña aquí; ver nota v5/v6.)
7. **V4-M7 — Extras (B4 a elegir)**: el de más valor (probablemente web push de
   avisos) según prioridad.

---

## §13. Buenas prácticas v4

Las de v1 §10, v2 §15 y v3 §14, más:

- **Backend tras interfaz**: todo el SDK del BaaS aislado en `src/lib/auth` y el
  repositorio; el resto de la app no sabe qué proveedor hay (portabilidad
  Cloud↔self-host).
- **RLS por defecto deny**: ninguna tabla accesible sin política explícita.
- **zod también en el backend boundary**; nunca confiar en la forma de lo que baja.
- **Offline-first real**: toda función nueva debe degradar sin sesión/red.
- **Privacidad por diseño** (§11) revisada en cada feature que toque datos.
- **Migraciones de esquema** (local y servidor) versionadas y testeadas; nunca
  perder datos del usuario.
