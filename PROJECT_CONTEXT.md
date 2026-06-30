# PROJECT_CONTEXT.md

Fotografía **breve y actual** del proyecto. Mantener compacto: al cerrar una
tarea, actualizar el estado, no acumular histórico (el detalle vive en
`SPECS_V3_PROGRESS.md` y en el historial de git).

_Actualizado: 2026-06-30._

## Estado actual

- **v1–v5** completas y mergeadas a `main`; v5 desplegada (POC). v3/v3.5 históricos.
- **Migración GitLab → GitHub (2026-06-30, corte total).** `origin` =
  `git@github-fodaveg:fodaveg/senda.git` (¡usar el alias SSH `github-fodaveg`,
  no `github.com`; ver memoria del proyecto!). CI en **GitHub Actions**
  (`.github/workflows/ci.yml`), deploy a **GitHub Pages** bajo `/senda`.
- **Backend Supabase ACTIVO en producción** (proyecto `senda`,
  `vxqbcqhoisvotybfsstn`, región EU). Claves `PUBLIC_SUPABASE_*` como secrets del
  repo → el build de prod ya trae cuentas/sync/login. `delete_account` aplicado;
  Site URL/Redirect URLs fijadas a Pages; confirmación de email activa.
- `main` = web en GitHub Pages; el trabajo de producto va por ramas (ver abajo).

## v6 — rediseño de la ficha (EN `main` y DESPLEGADA)

Rediseño según el **handoff** en `design_handoff_senda_v6/`. ⚠️ **La fuente de
verdad VISUAL es `Senda v6.dc.html`** (Design Component renderizado por
`support.js`; léelo, no solo el `README.md` en prosa — leer solo la prosa ya
causó un layout incorrecto que hubo que rehacer).

**El trabajo v6 está mergeado a `main` (FF) y publicado en Pages** (CI verde:
lint/check/321 unit/49 e2e + deploy). La rama `v6-ficha-rediseno` sigue las
nuevas tandas y se lleva a `main` por fast-forward.

**Hecho y desplegado (verde: lint/check/321 unit/49 e2e):**

1. Logo + wordmark «Senda» (Spectral 700 auto-alojada) en la cabecera global.
2. Barra superior como **dock flotante** (sticky, redondeada) + fix del enlace
   "Entrar" (era azul: estilos `.nav-link` scoped no llegaban a `AccountNav`).
3. **Switch Pestañas ⇄ Tablero modular** en la ficha (persistido en
   `$lib/ficha/layoutPref`; default Pestañas).
4. **Cabecera-tarjeta "banco de preparación"**: badge tipo + estado + fuente,
   nombre, métricas, acciones a la derecha (♡/✓/⌖ como iconos vía `RouteMarks`
   modo `compact`, Emergencia secundaria, Informe primaria), "Iniciar ruta"
   como nota reservada.
5. **Fase 3 — Resumen rediseñado** en rejilla 2 col (1.3fr/1fr): tarjeta de
   **recomendación con chips** de estado (Adelante/Precaución/No recomendado);
   izq. _Meteo de un vistazo_ (nuevo) + Ventana + Cómo llegar; der. Avisos +
   Riesgo incendio (resúmenes compactos que enlazan a Condiciones, **no** se
   duplican los componentes completos) + Datos clave + tarjeta **Mochila X/Y +
   "Ir a Preparación"**; abajo tira **Comunidad** (placeholder función futura).
   - **Estado de cielo**: `WeatherDay` no trae nubosidad → la condición "de un
     vistazo" (icono + etiqueta) se **deriva de la probabilidad de lluvia** en
     `$lib/weather/condition.ts` (`glanceCondition`, con tests). No se inventa
     "Despejado": etiquetas en términos de lluvia (Sin lluvia / poco probable /
     posible / probable).

6. **Fase 3 — Condiciones rediseñado** en rejilla 2 col (1fr/1fr): izq. mini-meteo
   de 3 días (iconos derivados de la prob. de lluvia, día lluvioso teñido) +
   Avisos + Riesgo de incendio; der. **Fauna** (badge "Orientativo", emoji por
   especie con respaldo, riesgo+consejo, **fuente real citada** —no "comunitaria
   sin verificar") + **Escapes** (lista A/B; campo de metadatos manual, vacío en
   el dataset FEMECV actual) + tarjeta **112** roja con botón a la ficha de
   emergencia. "Si llueve" (`notes_rain`) como tarjeta si existe.

7. **Widget "Mejor momento para empezar"**: `StartWindowCard` rediseñado como el
   widget del handoff (rango horario + barra con franja ideal en verde y franja
   de calor/UV a evitar en ámbar, sobre eje de horas de luz real del día; eje y
   franjas calculados de los datos de `startWindow`). MIDE movido a una caja de
   widget y subido; **Comunidad** queda como último bloque del Resumen.
8. **CI a Node 24**: `actions/checkout@v5` + `setup-node@v5`. Las acciones de
   Pages (configure/upload/deploy-pages) ya están en su última major; el aviso
   de Node 20 restante es de ellas (GitHub), no accionable por ahora.

9. **Fiabilidad (tanda 1)**: la lógica del widget de ventana se extrajo a una
   función pura testeada `startWindowTimeline` (eje de luz + franjas + marcas, en
   `engine/startWindow.ts`), y `wildlifeEmoji` se movió a `data/wildlife.ts`
   (puro). Ambas con tests. El componente solo presenta.
10. **Pestañas restantes (Acciones, Meteo, Mapa, Preparación)** al `.dc.html`:
    - **Acciones**: rejilla de 6 tarjetas-acción (informe, emergencia, exportar
      GPX/KML, mapa offline, leer por voz, compartir) + "Iniciar ruta" futura;
      enlaces/fuentes debajo. Nuevos: `geo/kml.ts` (`geojsonToKml`, puro + tests)
      y lectura por voz (Web Speech API, degrada si no hay soporte).
    - **Meteo**: toggle Por días ⇄ Por horas (día-tarjetas + tira horaria con
      icono derivado vía `precipIcon`, extraído de `condition.ts`) + WeatherCard
      como detalle. Los chips de fecha se mantienen (8, e2e).
    - **Mapa**: perfil de elevación en tarjeta con rango de altitud (mín→máx).
    - **Preparación**: mochila en tarjeta con total X/Y + agua/etapas/enlaza
      enmarcados. 338 unit / 49 e2e.

11. **Pulido + fiabilidad (tanda 2)**: la lectura por voz se **cancela** al
    cambiar de ruta y al salir de la ficha (antes seguía locutando); descarga de
    ficheros más robusta (ancla en el DOM + revocado diferido del blob URL);
    radio del mapa unificado con las tarjetas. **+2 e2e** (toggle Meteo
    días/horas, export GPX/KML). 338 unit / 51 e2e.

**v6 ficha COMPLETA y desplegada** (todas las pestañas + cabecera + 2 tandas de
fiabilidad/pulido).

**V6‑M4 — descubrimiento (home) rediseñado y desplegable** (variante A del
handoff). `src/routes/+page.svelte`: barra de controles (buscador + orden +
"Ruta al azar"), barra‑resumen (conteo en vivo + chips quitables + "Más filtros"
plegable, **colapsado por defecto**), y **fila de ruta** fiel al `.dc.html`
(miniatura decorativa, badge + nombre, meta con valores destacados, atribución
de fuente, columna estado + **corazón ♡ de favorito** que persiste). Orden por
**desnivel** añadido. Fuente por fila derivada de `federacion` (helper puro
`routeSourceLabel` con tests; `federacion` añadido a `RouteSummary`). Clustering,
mini‑ficha y conmutador Lista↔Mapa móvil ya existían (v3‑M4/v5). **340 unit /
52 e2e** en verde. (Las suites de filtros abren "Más filtros" antes de tocar el
panel; `province` usa el combobox para no colisionar con el aria‑label del
corazón en rutas con "PROVINCIAL".)

**Base `Card`** (V6‑M2): ya existe `src/lib/components/ui/Card.svelte` y el
barril `ui/index.ts`.

**Diario & Ajustes rediseñados (handoff §3).**

- **Diario** (`/diario`): 4 tarjetas de estadística (rutas hechas, distancia,
  desnivel, **días en monte** — `distinctDays` nuevo en `DiaryStats`, puro +
  test), **logros como medallas** (conseguido relleno / bloqueado punteado, icono
  por logro), **progreso por comarca** en barras dentro de tarjeta, desgloses
  año/tipo y salidas en tarjetas. Export/import intactos.
- **Ajustes** (`/ajustes`): cada `fieldset` pasa a **tarjeta v6** (superficie +
  sombra + radio) con `legend` como título; sin cambios de lógica.

Verificado en navegador. **342 unit / 52 e2e** en verde.

**Pasada de responsive móvil (390px) del rediseño v6.** Revisadas las 4
pantallas a 390px (Playwright). Ficha, diario y ajustes ya iban bien; arreglos en
el **home**: (1) la **fila de ruta** se reordenó —estado a la línea superior
junto al badge y **corazón táctil** arriba a la derecha (hijo directo de la fila,
ya no en columna lateral que estrechaba el nombre); miniatura 46px en móvil; (2)
el **panel de filtros** se **apila** en móvil (cada control a fila completa,
táctil) en vez del flex-wrap irregular. _Nota: el estado pasó a la línea superior
también en escritorio (junto al badge), es la consecuencia de mover el badge
fuera de la columna lateral._

**Auditoría del backlog (2026-06-30): casi todo estaba ya hecho.** Verificado en
código: a11y/perf (skip-link, focus-ring global, reduce-motion, skeletons),
**analítica opt-in + `/tendencias`**, **sincronización** (`SyncedRepository` +
cola offline + `merge.ts` + `SyncIndicator`), escala (índice ligero,
virtualización, búsqueda precomputada, clustering), i18n del **shell**, editar
material custom. Las specs (SPECS_V5/V6) están **desfasadas** respecto al código.

**Hecho en esta tanda:**

- **Página de privacidad/RGPD** (`/privacidad`) + enlace en pie/menú "Más"
  (i18n `nav.privacy`), fiel al comportamiento real (local-first; cuenta/analítica
  opt-in; terceros IGN/Open-Meteo/AEMET/OSRM/Supabase). _Revisar texto legal y
  datos del responsable antes de publicar._
- **Pulido de datos (ingesta)**: `dedupePois` (puro + tests) colapsa POIs OSM
  duplicados (mismo tipo/nombre ≤60 m). **Regenerados los 585 `data/routes`**:
  además del dedup, ahora persisten `federacion`/`comunidad`/`capabilities`
  (multi-federación V5-1). _Persistir `stages`/`parent_id` se DESCARTÓ a
  propósito: ya está codificado en los ids (`<padre>-e<NN>`) y se deriva puro en
  runtime; persistirlo sería duplicar._

**Bloqueado por decisión (pendiente de respuesta del usuario):**

- **Ingesta Navarra (multi-federación).** Fuentes alcanzables (MiSenda `ccaa=nc`
  200, IDENA WFS 200; deportenavarra 403 anti-bot). **IDENA sirve GeoJSON pero en
  EPSG:25830 (reproyectar) y por SENDERO completo, no por etapa**; MiSenda lista
  Navarra **por etapas** (79 etapas / 21 senderos). Desajuste etapa↔sendero +
  decisión de licencia (IDENA CC-BY vs GPX de MiSenda "licencia a confirmar") →
  hay que decidir el enfoque antes de ingerir. PoC en `scripts/ingest/poc/`.
- **Features de comunidad** (partes/valoraciones/planificador): añaden datos y
  backend (tablas Supabase + moderación/privacidad EXIF); falta elegir cuál y
  alcance.

**➡️ PRÓXIMO:** resolver las dos decisiones de arriba; y **SMTP propio** para los
correos de Supabase (lo dejamos para el final por petición del usuario). Backlog
en `SPECS_V6.md` y `SPECS_V5.md`.

**Deuda e2e (RESUELTA)**: el switch de pestañas ocultaba las secciones
inactivas con `display:none`, así que las aserciones sobre contenido fuera de
Resumen fallaban (≈25 tests). Arreglo: `tests/fixtures.ts` exporta `test/expect`
con un `addInitScript` que fija la disposición **Tablero** (`senderoscv:ficha-layout`
= `board`) → todas las secciones visibles a la vez en escritorio (viewport por
defecto de Playwright, ≥721px). Todos los `*.e2e.ts` importan de `./fixtures`.
Además se actualizaron selectores de la ficha al rediseño v6 (RouteMarks
compacto sin "me gusta" y con `aria-label`; "Datos clave" es etiqueta, no `h3`;
acciones Informe/Emergencia duplicadas cabecera↔Acciones → `.first()`; badge de
estado fuera del `h1`). **49 e2e en verde.**

**Gotcha de dev**: en `npm run dev`, Vite re-optimiza deps a media sesión y
rompe la hidratación con "Failed to fetch dynamically imported module …/nodes/0.js"
→ recarga dura / pestaña nueva (o reiniciar el server). No es bug de la app.

## v3 — qué incluye (referencia: SPECS_V3.md)

M1 mapa (capas IGN topo/satélite, track visible, pins inicio/fin) · M2 agua y
POIs en el mapa (fuente: OSM) con toggles · M3 etapas (relación padre↔etapas,
"Ver Etapas" funcional) · M4 descubrimiento (filtro provincia, fix enlace "Cómo
llegar") · M5 perfil de elevación bicolor + tooltip legible · M6 mochila con
material custom y aviso `warn` · M7 apariencia (toggle de tema + paletas).

## Decisiones vigentes

- **Sin backend en v3.** Cuentas, login/OTP, recuperación de contraseña y
  analítica central → **v4** (requiere backend; proveedor sin decidir,
  recomendado **Supabase**).
- Tema/paleta de color en **Ajustes** (no backoffice). Datos de usuario
  **anonimizables/exportables** para la futura agregación v4 (sin recopilar nada
  aún).
- **POIs**: FEMECV no los publica geolocalizados → fuente **OSM**
  (mirador/cumbre/patrimonio/refugio; nombre+tipo, **sin imágenes**).
- **Popularidad**: descartada (FEMECV no expone visitas/descargas/ranking).

## Prioridades actuales

1. **Backlog de pulido** ([SPECS_V3_PULIDO.md](SPECS_V3_PULIDO.md)), prioridad
   [A] primero.
2. (Hecho) `v3` validada y **mergeada a `main`**; la CI publica a Pages en cada push.

## Bloqueos

- El **cron cloud no puede hacer push al repo privado** (desactivado). Para
  trabajo nocturno autónomo: script wrapper local.
- Backend v4: **resuelto** — Supabase activo en prod (ver Estado actual).
- Tareas Supabase manuales restantes (Todoist): validar el flujo de correo real
  (alta/reset/OTP) — bloqueadas por los **rate limits del email integrado** de
  Supabase (free); para producción real, configurar SMTP propio.

## Áreas activas

- Pulido de v3 (ver backlog). El re-enrich OSM (agua/POIs, **585/585**) está
  completado y commiteado.
- **Pulido reciente (post-merge, jun-2026)**: app renombrada a **"Senda"**;
  marcadores de agua con icono 💧/🚰; popup de mapa tematizado (oscuro legible);
  galería de esquemas con tarjetas uniformes; reset global `box-sizing` que
  corrige inputs desbordados. Todo en `main` y publicado.
- **Escritorio (Tauri)**: `npm run tauri build -- --bundles dmg` genera
  `Senda_0.1.0_aarch64.dmg` (productName "Senda"); se renombra a `senda.dmg` a
  mano. Requiere **Node 22 de nvm** (el Node por defecto del sistema rompe el CLI
  de Tauri por el binario nativo).

## Documentación

- **Permanente**: `CLAUDE.md`, `ARCHITECTURE.md`.
- **Specs (referencia puntual, no leer enteras)**: `SPEC.md` (v1), `SPECS_V2.md`
  (v2), `SPECS_V3.md` (deltas v3), `SPECS_V4.md` (plan de la v4: cuentas + backend),
  `SPECS_V5.md` (exploratorio: deuda heredada + ideas de v5, sin plan cerrado).
- **Vivo v3**: `SPECS_V3_PROGRESS.md` (progreso/decisiones detalladas),
  `SPECS_V3_PULIDO.md` (backlog de pulido).
