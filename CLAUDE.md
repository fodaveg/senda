# CLAUDE.md — Senderos CV

La especificación de referencia del proyecto es **[SPEC.md](SPEC.md)**. Léela antes de implementar cualquier cosa; las decisiones de arquitectura del §1 están cerradas. La v2 está especificada en **[SPECS_V2.md](SPECS_V2.md)** y la v3 en **[SPECS_V3.md](SPECS_V3.md)** (deltas sucesivos; la v3 mantiene la arquitectura sin backend y aplaza a la v4 lo que exige servidor). El progreso y las decisiones de la v3 se registran en **[SPECS_V3_PROGRESS.md](SPECS_V3_PROGRESS.md)**.

## Reglas clave (resumen de SPEC.md)

- SvelteKit + TypeScript estricto, `adapter-static`. Shell nativo con Tauri 2. Sin Electron, sin backend, sin base de datos en runtime.
- Lógica de negocio (motor de reglas, normalizador meteo, generador de informe) **pura y sin imports de Svelte**, en `src/lib/engine`, `src/lib/weather`, `src/lib/report`.
- Validación de datos externos con zod en los límites (ingesta, respuestas meteo).
- Prohibido inventar metadatos de ruta: dato no verificado → `null` + entrada en `sources`.
- Wikiloc no se integra como fuente de datos (solo enlace manual opcional).
- La app funciona 100% offline salvo el módulo meteo, que degrada con elegancia.
- Conventional commits. Cada milestone (§9) termina con tests en verde y un commit.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run ingest [-- <id>] [-- --lenient]` — ingesta GPX+manual+crawled → data/routes/\*.json (validación zod)
- `npm run ingest:crawl [-- --limit N]` — crawler del portal FEMECV completo → \_crawled/ + GPX (rate-limit 1 s)
- `npm run ingest:enrich [-- --limit N]` — enriquecimiento OSM (agua, sombra, alternativas); reanudable
- `npm run catalog:publish [dest]` — empaqueta data/ + manifest.json para GitLab Pages
- `npm run build` — build web estático (`build/`)
- `npm run lint` — prettier --check + eslint
- `npm run check` — svelte-check (TypeScript)
- `npm run test:unit -- --run` — tests unitarios (Vitest)
- `npm run test:e2e` — e2e (Playwright; instala navegadores la primera vez)
- `npm run tauri dev` / `npm run tauri build` — app nativa (requiere Rust)

Node ≥ 20 (ver `.nvmrc`).
