# CLAUDE.md — Senderos CV

La especificación de referencia del proyecto es **[SPEC.md](SPEC.md)**. Léela antes de implementar cualquier cosa; las decisiones de arquitectura del §1 están cerradas.

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
- `npm run ingest [-- <id>]` — ingesta GPX+manual → data/routes/\*.json (validación zod)
- `npm run build` — build web estático (`build/`)
- `npm run lint` — prettier --check + eslint
- `npm run check` — svelte-check (TypeScript)
- `npm run test:unit -- --run` — tests unitarios (Vitest)
- `npm run test:e2e` — e2e (Playwright; instala navegadores la primera vez)
- `npm run tauri dev` / `npm run tauri build` — app nativa (requiere Rust)

Node ≥ 20 (ver `.nvmrc`).
