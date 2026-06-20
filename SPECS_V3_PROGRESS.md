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
- [x] V3-M3 — Etapas: relación padre↔etapas DERIVADA de los ids existentes (`<padre>-eNN`) en `src/lib/data/stages.ts` (sin re-crawlear: 13 padres "Ver Etapas", 111 etapas ya en el catálogo); `StagesList.svelte` + sección "Etapas" en la ficha + "Ver Etapas" enlaza a ella + enlace de vuelta al padre desde cada etapa. Tests: stages.spec, stages.e2e. PENDIENTE menor: persistir `stages`/`parent_id` en el modelo/crawler (ahora se deriva en runtime, que cumple el objetivo); mapa del padre con todas las etapas juntas.
- [x] V3-M4 — Descubrimiento: [x] fix "Cómo llegar" (enlace OSM con from+to); [x] filtro por provincia (derivada de comarca en `src/lib/geo/province.ts`, sin re-crawl; selector en el listado); [x] orden por popularidad → DESCARTADO (criterio de salida §13): FEMECV no publica popularidad real (ni visitas, ni descargas, ni puntuación/ranking), solo un "N valoraciones" muy disperso (0–1 en casi todas) que además requeriría re-crawl; no es señal usable. Tests: travel.e2e, province.e2e, province.spec, filters.spec.
- [x] V3-M5 — Perfil de elevación: relleno bicolor (terreno bajo la curva / cielo encima) + tooltip con caja de contraste fijo (oscura + texto blanco), legible en cualquier tema. En `ElevationProfile.svelte`. Test: profile.e2e.
- [x] V3-M6 — Mochila custom: motor `evaluateCustomGear` con estado `warn` (anti-reglas por atributo, fail-safe) en `src/lib/engine`; persistencia versionada con zod + export/import en `src/lib/user/customGear.ts`; UI `CustomGearPanel.svelte` (alta/baja + avisos) en la ficha. Tests: customGear.spec (motor), customGear.spec (datos), custom-gear.e2e. PENDIENTE menor: reflejar el material custom en el informe imprimible y en el checklist (ahora solo en la ficha).
- [x] V3-M7 — Apariencia: toggle rápido claro/oscuro en la barra (`ThemeToggle.svelte`) + paletas de color curadas (`src/lib/theme/palettes.ts`, aplicadas con CSS `light-dark()`, una fuente de verdad) elegibles en Ajustes; `palette` añadido a settings. Tests: palettes.spec, theme.e2e.

## Investigaciones pendientes (SPECS_V3.md §13, criterio de salida)

- [x] ¿FEMECV expone popularidad/visitas por ruta? NO (solo "N valoraciones", recuento disperso). → ordenación por popularidad descartada (ver V3-M4).
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

### V3-M2 (capas de datos en el mapa) — BLOQUEADO por datos (decisión del usuario)

Investigación §13 (2026-06-19):

- **POIs (#14):** ningún GPX de FEMECV trae `<wpt>` (0 de 585). No hay fuente de
  puntos de interés en los tracks. Pendiente: comprobar si la **ficha web** de
  FEMECV publica POIs con descripción/imagen y, si es así, extender el crawler.
  Hasta confirmarlo, **no hay POIs que pintar** (no se inventan).
- **Fuentes de agua (#9):** `scripts/ingest/enrich/osm.ts` SÍ obtiene `lat/lon`
  de cada fuente/manantial (`OsmWaterNode`), pero el enriquecido las colapsa a
  **texto** (`"… (km X, a N m del track; OSM)"`) y descarta las coordenadas. Sin
  coords no se pueden pintar marcadores.

**Soluciones propuestas (a decidir por David):**

1. _(recomendada)_ Persistir las fuentes con coordenadas: añadir al modelo un
   campo estructurado `water_points_geo: [{ name, kind, lat, lon, km, dist_m }]`
   (zod en `schema.ts`), guardar eso en el enrich junto al texto actual, y
   **re-ejecutar `npm run ingest:enrich`** (red OSM, lento, ~585 rutas con
   rate-limit; ojo a la incidencia de DNS del router). Luego re-publicar
   catálogo. El texto actual se conserva para compatibilidad.
2. Mínimo viable sin re-crawl: pintar agua solo en las rutas que ya tengan
   coords si alguna las tuviera (no es el caso) → no aporta.
3. Aplazar V3-M2 hasta tener decidido lo de POIs y hecho el re-enrich.

**Acción tomada:** no re-ejecuto el enrich por mi cuenta (cambia datos y va por
red). Salto a milestones que no dependen de re-crawlear (M5, M7, parte de M4) y
dejo M2 a la espera de tu decisión.

### Otros datos a confirmar antes de implementar

- **Popularidad (#6, M4):** confirmar si la ficha FEMECV expone visitas/descargas.
  Si no → no se ofrece la ordenación (no implementar a ciegas).
- **Provincia (#7, M4):** parece **derivable en la app** desde comarca/zona con un
  mapa estático (comarca→provincia), sin re-crawl. Vía segura; pendiente de
  verificar qué campo de comarca/zona hay en las rutas.
