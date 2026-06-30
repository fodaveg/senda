# CLAUDE.md — Senderos CV

App de senderos homologados FEMECV de la Comunitat Valenciana: **SvelteKit +
Tauri 2**, recomendación de mochila condicionada por meteo, informes Markdown e
imprimibles. Funciona offline salvo los módulos online declarados.

## Estrategia de lectura de contexto (IMPORTANTE — ahorra tokens)

Lee en este orden y **para en cuanto tengas lo necesario**:

1. **[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)** — estado actual, decisiones
   vigentes, prioridades, bloqueos.
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — capas, módulos, flujos, límites.
3. **Búsqueda** (Grep/Glob) de los archivos implicados en la tarea.
4. **Solo si la tarea lo exige**, lee **secciones concretas** de las specs.

⚠️ Las specs (`SPEC.md`, `SPECS_V2.md`, `SPECS_V3.md`, `SPECS_V4.md` —plan de la
v4, aún no implementada) **NO se leen enteras por
defecto**: son largas y en su mayoría histórico/justificación. Úsalas como
referencia puntual (una sección concreta) cuando la tarea lo pida.

## Reglas permanentes (innegociables)

- **Sin backend, sin BD en runtime.** Hosting estático: la app solo hace GET de
  ficheros. (La v4 reabrirá esta decisión; hasta entonces no se introduce
  servidor.)
- **Lógica de negocio pura, sin imports de Svelte** (motor de mochila,
  normalizador meteo, generador de informe, geo, derivaciones de datos).
- **zod en todos los límites** de datos externos (ingesta, meteo, OSRM, OSM,
  catálogo, datos de usuario).
- **Prohibido inventar metadatos**: dato no verificado → `null` + entrada en
  `sources`. Aplica también a etapas, POIs, agua y popularidad.
- **Wikiloc nunca como fuente de datos** (solo enlace saliente).
- **Degradación elegante** de lo online (estado vacío, nunca rotura ni dato
  inventado). Online: Open-Meteo, AEMET (opc. + avisos CAP), OSRM, actualización
  de catálogo, tiles IGN.
- **Datos de usuario**: localStorage con esquema versionado y migración;
  export/import; nunca perder datos; diseñados **anonimizables** (futura
  analítica v4).
- **Tests por cada función nueva; no romper los existentes.** Cada milestone
  termina con tests en verde + commit. No avanzar con tests en rojo.
- **Documentar on the fly**: comentario/doc en cada clase o función a la vez que
  el código, no como paso aparte.

## Convenciones técnicas

- SvelteKit 2 + **TypeScript estricto**, `adapter-static`. **Svelte 5 runes**
  (`$props/$state/$derived/$effect`). Shell Tauri 2. **UI en español.**
- Mapas: **MapLibre GL** + WMTS **IGN** (CC-BY). Track GPX→GeoJSON.
- **Conventional commits en español.** Mensajes de commit terminan con la línea
  `Co-Authored-By: …`.
- Node ≥ 20 (`.nvmrc`). En este entorno: Node 22 de nvm + registry público
  (detalle en memoria/PROJECT_CONTEXT).

## Mapa rápido de módulos

(Flujos y responsabilidades en ARCHITECTURE.md.)

- `src/lib/engine` — motor de mochila puro (`evaluate`, `attributeRules`,
  `startWindow`).
- `src/lib/weather` — clientes meteo (`openmeteo`, `aemet`, `hourly`, `avisos`) +
  `dates`.
- `src/lib/geo` — `distance`, `gpx`, `profile`, `routing` (OSRM), `province`.
- `src/lib/map` — `layers` (capas IGN), `tiles`, `track` (extremos).
- `src/lib/data` — `routes` (carga estática), `schema` (zod de ruta), `tracks`,
  `stages`, `gear`, `wildlife`.
- `src/lib/user` — `marks`, `stats` (diario), `checklist`, `customGear` (todo
  localStorage versionado).
- `src/lib/catalog` — actualización del catálogo en runtime (`store`, `update`,
  `url`).
- `src/lib/report` — informe y ficha de emergencia (`model`, `markdown`,
  `emergency`).
- `src/lib/theme` (`palettes`) · `src/lib/settings.ts` (ajustes).
- `src/lib/components` — UI (Map, BackpackPanel, CustomGearPanel,
  ElevationProfile, StagesList, ThemeToggle, WeatherCard, …).
- `src/routes` — `/` (listado+mapa), `/ruta/[id]` (ficha), `/ajustes`, `/diario`.
- `scripts/ingest` — pipeline manual (`crawl`, `build`, `enrich/osm`); **no
  runtime**.

## Comandos

- `npm run dev` · `build` · `lint` · `check` · `test:unit -- --run` · `test:e2e`
- `npm run ingest [-- <id>] [-- --lenient]` · `ingest:crawl [-- --limit N]` ·
  `ingest:enrich [-- <id>] [-- --limit N] [--force]`
- `npm run catalog:publish [dest]` · `npm run tauri dev|build`

**Verificación antes de cada commit:** `lint`, `check`, `test:unit -- --run` y
`test:e2e` en verde.

## Exclusiones de lectura (no leer salvo necesidad explícita)

Pesados/generados/derivados: consumen muchísimo contexto y casi nunca aportan.
Si trabajas en su forma, lee **un único fichero de muestra**, no el directorio.

- `data/gpx/**` (585 GPX) · `data/routes/*.json` (≈585 datasets) ·
  `data/routes/_crawled/**` (≈839) · `data/routes/_enriched/**` (≈579) — salida
  de la ingesta.
- `build/`, `.svelte-kit/`, `node_modules/`, `src-tauri/target/` — artefactos.
- `package-lock.json`.
- Specs completas — solo secciones puntuales (ver estrategia de lectura).

## Trabajo en curso

- **`v3` ya está mergeada en `main`** (la rama `v3` queda como histórico); v3.5
  también integrada. El trabajo actual va **directo sobre `main`** = web
  desplegada en GitHub Pages, así que cada push publica. Estado vivo y
  prioridades en PROJECT_CONTEXT.md.
