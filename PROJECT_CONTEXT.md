# PROJECT_CONTEXT.md

Fotografía **breve y actual** del proyecto. Mantener compacto: al cerrar una
tarea, actualizar el estado, no acumular histórico (el detalle vive en los
commits y en `SPECS_V3_PROGRESS.md`).

_Actualizado: 2026-06-30._

## Estado actual

- **Todo (v1–v6) en `main` y DESPLEGADO** en GitHub Pages bajo `/senda`
  (`https://fodaveg.github.io/senda/`). Cada push a `main` publica vía CI.
- **Git**: `origin = git@github-fodaveg:fodaveg/senda.git` — **pushear con el
  alias SSH `github-fodaveg`**, no `github.com` (ver memoria del proyecto). CI en
  GitHub Actions (`.github/workflows/ci.yml`, Node 24): lint · check · unit · e2e
  · build + catálogo · deploy a Pages.
- **Backend Supabase ACTIVO en producción** (`senda`, `vxqbcqhoisvotybfsstn`, EU):
  el build de prod trae cuentas, login, **sincronización** (cola offline +
  `SyncIndicator`), borrar/exportar cuenta, **analítica opt-in** + `/tendencias`.
- **Multi-federación**: el catálogo ya no es solo FEMECV. Ver abajo.

## Catálogo y datos

- **FEMECV / Comunitat Valenciana**: ~585 rutas (fuente oficial FEMECV + traza
  GPX; agua/POIs/sombra de OSM por enriquecimiento).
- **FNDME / Navarra** (1ª federación añadida, 2026-06-30): **35 senderos** `na-*`
  con **geometría oficial CC-BY de IDENA WFS** (reproyectada EPSG:25830→WGS84) y
  lista/estado/etapas de MiSendaFEDME (`ccaa=nc`). 30/35 enriquecidos con OSM.
  Pipeline en `scripts/ingest/navarra/` (`npm run ingest:navarra`, y
  `-- --merge-enriched` para fusionar el OSM porque las `na-*` no pasan por la
  build normal).
- El catálogo se carga por glob de `data/routes/*.json`; los tracks GPX de
  `data/gpx` se copian a `static/gpx` (sync-gpx) en pre dev/build.

## v6 — rediseño UX/UI (COMPLETO y desplegado)

Según el **handoff** `design_handoff_senda_v6/`. ⚠️ **La fuente de verdad VISUAL
es `Senda v6.dc.html`** (Design Component; léelo, no solo el README en prosa —
leer solo la prosa causó un layout incorrecto que hubo que rehacer).

Rediseñadas las 4 pantallas + sistema de diseño:
- **Ficha** (`/ruta/[id]`): cabecera-tarjeta "banco de preparación" + pestañas ⇄
  tablero; Resumen como panel de decisión (recomendación, meteo de un vistazo,
  ventana de inicio, avisos, incendio, cómo llegar, mochila); Condiciones,
  Preparación, Meteo (días/horas), Mapa+perfil, Acciones (informe, emergencia,
  export GPX/KML, voz, …).
- **Home** (`/`): controles (buscar + orden incl. desnivel + ruta al azar),
  barra-resumen con chips quitables + "Más filtros" plegable, fila de ruta con
  atribución de fuente y corazón de favorito; clustering + mini-ficha; conmutador
  Lista↔Mapa en móvil.
- **Diario** (`/diario`): tarjetas de estadística (incl. "días en monte"), logros
  como medallas, progreso por comarca; **Ajustes** (`/ajustes`): secciones como
  tarjetas v6.
- **Responsive móvil** revisado a 390px; barra inferior de navegación.
- Sistema de diseño en `src/lib/components/ui/` (Card, Button, Badge, Section,
  Skeleton…); a11y (skip-link, focus-ring, reduce-motion); i18n del shell en
  `src/lib/i18n.ts` (solo español por ahora).
- **Privacidad/RGPD** (`/privacidad`) enlazada en pie/menú. _Texto fiel al
  comportamiento real, pendiente de revisión legal antes de difundir._

## Decisiones vigentes

- **Hosting estático, sin BD en runtime** salvo lo online declarado (Supabase
  para cuentas/sync/analítica; Open-Meteo/AEMET, OSRM, tiles IGN). Degradación
  elegante de todo lo online.
- **Prohibido inventar metadatos**: dato no verificado → `null` + entrada en
  `sources`. Wikiloc solo enlace, nunca fuente.
- **Multi-federación (V5-1)**: `Route.federacion`/`comunidad`/`capabilities` +
  `etapas_meta` (etapas como metadato cuando la fuente no las codifica en el id,
  caso FNDME; FEMECV las deriva del id `<padre>-e<NN>`). Atribución por fila vía
  `routeSourceLabel`. Navarra usa **IDENA CC-BY** para geometría (no el GPX de
  MiSenda, de licencia sin confirmar).
- **POIs**: OSM (mirador/cumbre/patrimonio/refugio; sin imágenes), deduplicados
  (`dedupePois`). **Popularidad** descartada (FEMECV no la expone).
- Datos de usuario en localStorage versionado, anonimizables/exportables.

## Pendiente

- **Único bloqueo real: SMTP propio para los correos de Supabase.** Hoy usa el
  email integrado (rate limits del plan free) → no permite validar alta/reset/OTP
  de forma fiable en producción.
- Menores: revisar el texto legal de `/privacidad`; reintentar `ingest:enrich` de
  los 5 senderos de Navarra que dieron 504 de Overpass; `comunidad` (partes/
  valoraciones) descartada por ahora.

## Gotchas y operativa

- **e2e**: `tests/fixtures.ts` fija la disposición **Tablero** (todas las
  secciones visibles) para que las aserciones fuera de Resumen funcionen; todos
  los `*.e2e.ts` importan de `./fixtures`.
- **dev**: Vite re-optimiza deps a media sesión y rompe la hidratación
  ("Failed to fetch dynamically imported module …/nodes/0.js") → recarga dura o
  reiniciar el server. No es bug de la app.
- **Tauri**: `npm run tauri build -- --bundles dmg` → `Senda_0.1.0_aarch64.dmg`
  (se renombra a `senda.dmg`). Requiere **Node 22 de nvm**.
- **Cron cloud** no puede pushear al repo (desactivado): para trabajo autónomo,
  wrapper local.

## Documentación

- **Permanente**: `CLAUDE.md`, `ARCHITECTURE.md`.
- **Specs (referencia puntual, parcialmente desfasadas respecto al código —
  verificar antes de fiarse)**: `SPEC.md`, `SPECS_V2.md`, `SPECS_V3.md`,
  `SPECS_V4.md`, `SPECS_V5.md` + `SPECS_V5_FEDERACIONES.md` /
  `SPECS_V5_CCAA_ENDPOINTS.md` (dosier de fuentes por CCAA), `SPECS_V6.md`.
- **Vivo**: `SPECS_V3_PROGRESS.md`, `SPECS_V3_PULIDO.md`.
