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

## v6 — rediseño de la ficha (rama `v6-ficha-rediseno`, EN CURSO)

Rediseño según el **handoff** en `design_handoff_senda_v6/`. ⚠️ **La fuente de
verdad VISUAL es `Senda v6.dc.html`** (Design Component renderizado por
`support.js`; léelo, no solo el `README.md` en prosa — leer solo la prosa ya
causó un layout incorrecto que hubo que rehacer).

**Hecho y commiteado en la rama (verde: lint/check/321 unit):**

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

**Pendiente (Fase 3 — Condiciones):**

- Dar fidelidad a Condiciones (fauna/escape/112 ya tienen datos).

**Deuda de la rama**: la suite **e2e está rota globalmente** desde el rediseño
de pestañas (≈25 tests fallan, incl. `home`/`discover`, ajenos a la ficha;
contenido oculto tras `display:none` de las pestañas inactivas, dock, etc.).
La Fase 3 **no** añade regresión (delta neto 0, ±1 por flakiness en
`discover.e2e`). Pendiente: pase dedicado de reparación e2e para la v6.

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
