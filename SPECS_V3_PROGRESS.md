# SPECS_V3 — Progreso y decisiones

Estado de avance de la v3 y registro de decisiones acordadas. Este fichero es la
**fuente de verdad para retomar el trabajo** (incluida la rutina automática en la
nube). Actualízalo en cada sesión: marca milestones, anota decisiones nuevas y
deja registrado cualquier bloqueo.

## Decisiones acordadas con el usuario (2026-06-19)

- **v3 = SIN backend.** Se mantiene la arquitectura cerrada de v1/v2. Las
  funcionalidades que exigen servidor se **aplazan a la v4** (ver SPECS_V3.md §11):
  cuentas, login con OTP, recuperación de contraseña, backoffice de usuario y
  recopilación central de analítica anónima.
- **Backend de la v4 sin decidir.** El usuario se informará sobre **Supabase**
  (recomendación) y lo confirmará más adelante. NO empezar nada de v4 sin esa
  decisión.
- **Selección de tema/paleta → en Ajustes**, no en un backoffice de usuario
  (al no haber cuentas en v3). Persistencia local.
- **Datos de usuario diseñados anonimizables y exportables** desde ya, para que
  la futura analítica v4 pueda agregarlos sin rehacer el formato. En v3 NO se
  recopila ni se envía nada.

## Hechos verificados contra el código (no re-investigar)

- Modo oscuro YA existe: `src/lib/settings.ts` (`theme: auto|claro|oscuro`),
  aplicado en `src/routes/+layout.svelte` y elegible en `src/routes/ajustes`.
  v3 añade un toggle rápido en la barra + paletas de color (no existen aún).
- "Cómo llegar": `src/routes/ruta/[id]/+page.svelte` (~línea 448) genera el
  enlace OSM con solo `?to=<inicio>` (sin `from`). Hay que añadir el origen.
- Etapas: el crawl ya marca `status_detail: "Ver Etapas"` (gr-7, gr-36, gr-37,
  gr-160, gr-239, gr-331…) y existen GPX `<padre>-e<NN>` (p. ej. `gr-236-e01`).
  Falta modelar padre↔etapas y mostrarlo; "Ver Etapas" es texto muerto.
- Mapa base: v2 dejó IGN como base única (`src/lib/map/tiles.ts`, protocolo
  `ign://` en `src/lib/components/Map.svelte`). v3 añade selector de capas.
- `water_points` enriquecidos por OSM (v2 §12) tienen coords → pintables.

## Estado de los milestones (SPECS_V3.md §12)

- [x] V3-M1 — Mapa base: selector de capas IGN (MTN topo por defecto/offline + PNOA satélite) + track con anchos interpolados por zoom (visible a poca escala) + pins de inicio/fin (un solo pin si circular). Capas en `src/lib/map/layers.ts`, extremos en `src/lib/map/track.ts`, UI en `Map.svelte`. Tests: layers.spec, track.spec, map.e2e. Pendiente futuro: añadir capa "Callejero" (IGN Base) si se confirma su WMTS, y persistir la capa en el módulo de apariencia de V3-M7 (ahora va en localStorage `senderoscv:map-layer`).
- [ ] V3-M2 — Capas de datos: agua + POIs con toggles + crawl de waypoints
- [ ] V3-M3 — Etapas: crawl relación + modelo + StagesList + "Ver Etapas" funcional
- [ ] V3-M4 — Descubrimiento: filtro provincia + orden popularidad (si viable) + fix "Cómo llegar"
- [ ] V3-M5 — Perfil de elevación: bicolor + tooltip legible
- [ ] V3-M6 — Mochila custom: atributos + estado `warn` + checklist/informe + formato anonimizable
- [ ] V3-M7 — Apariencia: toggle en barra + paletas en Ajustes

## Investigaciones pendientes (SPECS_V3.md §13, criterio de salida)

- [ ] ¿FEMECV expone popularidad/visitas por ruta? Si no → sin orden por popularidad.
- [ ] ¿Los GPX/ficha traen waypoints/POIs con descripción e imágenes citables?
- [ ] Confirmar que la relación padre↔etapas es derivable por id `-eNN` y/o ficha.

## Cómo trabajar (recordatorio para cualquier sesión, incl. la rutina nube)

- Node 22. Dejar en verde antes de cada commit: `npm run lint`, `npm run check`,
  `npm run test:unit -- --run`, `npm run test:e2e`.
- Tests para cada función nueva; no romper los existentes. Documentar on the fly.
- Conventional commits en español. Commitea cada pieza terminada y haz push.
- Lógica de negocio pura (motor, etc.) sin imports de Svelte; zod en los límites.
- No inventar metadatos: dato no verificado → `null` + `sources`.
- Si te bloqueas en algo irreversible, anótalo aquí y haz solo lo seguro.

## Bloqueos / notas

- (ninguno por ahora)
