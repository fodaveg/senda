# Senda

App autocontenida (Linux, macOS y web) con las rutas oficiales de senderismo de la Comunitat Valenciana (senderos homologados FEMECV), recomendación de equipo de mochila condicionada por ruta y meteorología, y generación de informes Markdown (Obsidian) e imprimibles.

Especificación completa en [SPEC.md](SPEC.md). La v2 está especificada en [SPECS_V2.md](SPECS_V2.md).

## Stack

- **Frontend**: SvelteKit + TypeScript (`adapter-static`), misma base de código para web/PWA y escritorio.
- **Escritorio**: Tauri 2 (binarios Linux y macOS).
- **Mapas**: MapLibre GL JS (tiles IGN España, CC-BY 4.0) con mapa offline descargable por ruta.
- **Meteo**: Open-Meteo (primaria, sin key) + AEMET OpenData (verificación opcional).
- **Datos**: estáticos en build (`data/`); sin backend ni base de datos.
- **PWA**: instalable y 100% offline salvo meteo y tiles (service worker con precaché del shell, rutas y tracks).
- **Tests**: Vitest (unitarios) + Playwright (e2e).

## Requisitos

- **Node.js ≥ 20** (ver `.nvmrc`; con nvm: `nvm use`).
- **Rust estable** (solo para la app de escritorio): <https://rustup.rs>.

### Dependencias de sistema para Tauri

**Fedora:**

```sh
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel
sudo dnf group install "c-development"
```

**macOS:**

```sh
xcode-select --install
```

## Desarrollo

```sh
npm install
npm run dev          # web en http://localhost:5173
npm run tauri dev    # app de escritorio
```

## Build

```sh
npm run build        # web estática en build/
npm run tauri build  # binario nativo (src-tauri/target/release/)
```

## Calidad

```sh
npm run lint               # prettier + eslint
npm run check              # svelte-check (TypeScript)
npm run test:unit -- --run # tests unitarios
npm run test:e2e           # e2e Playwright (instala navegadores la 1.ª vez)
```

## Catálogo de rutas (ingesta)

El catálogo completo se importa del portal oficial FEMECV:

```sh
npm run ingest:crawl          # todas las fichas + GPX (respetuoso: 1 req/s, ~30 min)
npm run ingest:enrich         # opcional: fuentes de agua/sombra desde OSM (reanudable)
npm run ingest -- --lenient   # regenera data/routes/*.json validando con zod
```

El crawler escribe `data/routes/_crawled/<id>.json` (ficha oficial: nombre, estado de homologación, MIDE, municipio, comarca…) y descarga el GPX si falta. Reejecutarlo refresca estados sin tocar nada manual.

Para corregir o ampliar una ruta a mano, crea `data/routes/_manual/<id>.json` (obligatorios: `name`, `type`, `sources`; toda afirmación con origen). Prioridad del merge: **manual > crawleado > derivado del GPX**.

La CI publica el dataset versionado en GitHub Pages (`manifest.json` + datos); la app lo consume desde Ajustes → "Buscar actualizaciones de rutas" sin necesidad de reinstalar.

## Ajustes (en la app)

- **AEMET OpenData** (opcional): con una [api key gratuita](https://opendata.aemet.es/centrodedescargas/altaUsuario), el panel meteo muestra una segunda fuente de verificación. Si las fuentes difieren significativamente (p. ej. prob. de lluvia ±30 pts) se marcan ambas; nunca se promedian.
- **Carpeta del vault**: carpeta por defecto del "Guardar como…" de informes en la app de escritorio (p. ej. tu vault de Obsidian).

## Estructura

Ver §2 de [SPEC.md](SPEC.md): `src/lib/{engine,weather,report,components}`, `data/{routes,gpx,gear,wildlife}`, `scripts/ingest`, `src-tauri/`.
