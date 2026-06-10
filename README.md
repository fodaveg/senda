# Senderos CV

App autocontenida (Linux, macOS y web) con las rutas oficiales de senderismo de la Comunitat Valenciana (senderos homologados FEMECV), recomendación de equipo de mochila condicionada por ruta y meteorología, y generación de informes Markdown (Obsidian) e imprimibles.

Especificación completa en [SPEC.md](SPEC.md).

## Stack

- **Frontend**: SvelteKit + TypeScript (`adapter-static`), misma base de código para web/PWA y escritorio.
- **Escritorio**: Tauri 2 (binarios Linux y macOS).
- **Mapas**: MapLibre GL JS.
- **Datos**: estáticos en build (`data/`); sin backend ni base de datos.
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

## Estructura

Ver §2 de [SPEC.md](SPEC.md): `src/lib/{engine,weather,report,components}`, `data/{routes,gpx,gear,wildlife}`, `scripts/ingest`, `src-tauri/`.
