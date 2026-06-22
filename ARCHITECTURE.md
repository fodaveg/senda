# ARCHITECTURE.md

Estructura estable del proyecto: capas, módulos, flujos de datos y límites. El
**porqué** de cada decisión está en las specs (lectura puntual); aquí va el
**qué** y el **dónde**.

## Capas

1. **Datos estáticos (build)** — `data/routes/*.json`, `data/gpx/*.gpx`,
   `data/gear/*`, `data/wildlife/*`. Se cargan con `import.meta.glob`
   (`src/lib/data/routes.ts`). Salida de la ingesta; no se editan a mano.
2. **Catálogo actualizable (runtime)** — `src/lib/catalog`: descarga
   `manifest.json` + ficheros desde Pages a almacén local (IndexedDB en web/PWA,
   FS en Tauri). El loader resuelve **override local → seed empaquetado**.
3. **Lógica de negocio (pura, sin Svelte)** — `engine`, `weather`, `geo`,
   `report`, y derivaciones de `data` (`stages`, `province`). Testeada con Vitest.
4. **UI (Svelte 5)** — `src/lib/components` + `src/routes`.
5. **Shell nativo** — Tauri 2 (`src-tauri/`).
6. **Pipeline de ingesta (offline, no runtime)** — `scripts/ingest`: crawl del
   portal FEMECV → `_crawled`; enrich OSM → `_enriched`; `build` hace el merge →
   `data/routes/*.json`.

## Flujo de datos de una ruta

```
FEMECV portal ──crawl──▶ data/routes/_crawled/*
OSM Overpass  ──enrich─▶ data/routes/_enriched/*   (agua, sombra, POIs, alternativas)
manual                  data/routes/_manual/*
GPX                     data/gpx/*.gpx
            │
            ▼  scripts/ingest/build (merge + zod)        prioridad: manual > crawled > enriched > derivado del GPX
   data/routes/<id>.json
            │  import.meta.glob (build)              ┌─ runtime: src/lib/catalog puede sustituir por catálogo descargado
            ▼                                        ▼
        App (src/lib/data/routes.ts) ───────────────┘
            │
   /ruta/[id]: carga GPX (data/tracks → geo/gpx) ─▶ mapa (components/Map) + perfil (geo/profile)
            └─ meteo (weather) ─▶ motor mochila (engine) ─▶ BackpackPanel / report
```

## Módulos y responsabilidades

| Módulo                 | Responsabilidad                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `lib/engine`           | Motor de mochila puro: reglas, material custom (`warn`), ventana de inicio                                                      |
| `lib/weather`          | Clientes meteo (Open-Meteo/AEMET, horaria, avisos CAP) + normalización                                                          |
| `lib/geo`              | Distancia haversine, GPX→GeoJSON, perfil de elevación, OSRM, provincia                                                          |
| `lib/map`              | Catálogo de capas IGN, URLs de tiles, extremos del track (pins)                                                                 |
| `lib/data`             | Carga estática de rutas, schema zod, tracks, etapas, gear, fauna                                                                |
| `lib/user`             | Marcas, diario/estadísticas, checklist, material custom (localStorage) tras `UserDataRepository` (v4 §A1) + fusión `sync/merge` |
| `lib/catalog`          | Actualización del catálogo en runtime (manifest, almacén, deltas)                                                               |
| `lib/report`           | Modelo de informe + Markdown (Obsidian) + ficha de emergencia                                                                   |
| `lib/theme`/`settings` | Paletas de color y ajustes locales (tema, origen, api key AEMET)                                                                |
| `lib/components`       | UI reutilizable (mapa, paneles, perfil, badges)                                                                                 |
| `routes`               | Páginas: listado+mapa, ficha de ruta, ajustes, diario                                                                           |
| `scripts/ingest`       | Crawler FEMECV, enrich OSM, build (merge+validación) — manual, offline                                                          |

## Límites arquitectónicos

- **Pureza**: `engine`/`weather`/`report`/`geo` y las derivaciones de `data` no
  importan Svelte ni hacen red directamente. La red vive en clientes con
  `fetchFn` inyectable (caché con TTL, errores tipados) y en los `*-cli` de
  `scripts`.
- **Validación**: zod en cada frontera (ingesta, respuestas online, catálogo
  descargado, import de datos de usuario). Un fichero inválido se rechaza entero.
- **Estado del usuario** solo en `src/lib/user` (localStorage, esquema
  versionado con migración). Nada se envía a terceros.
- **Sin backend**: todo es GET de estáticos; los módulos online degradan a estado
  vacío sin romper.
- **Base cartográfica IGN**: online y offline equivalentes; los tiles de la capa
  por defecto (MTN) se cachean por ruta (protocolo `ign://`).

## Online vs. offline

La app funciona 100% offline salvo los módulos online declarados (meteo, avisos
AEMET, OSRM, actualización de catálogo, tiles no descargados), que muestran
estado vacío y nunca datos inventados. Los datos de ruta vienen del seed
empaquetado aunque nunca se haya actualizado el catálogo.
