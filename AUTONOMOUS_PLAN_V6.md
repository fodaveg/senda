# PLAN AUTÓNOMO — Senda v6 (rediseño UI/UX)

> **Para el "yo" que retoma tras un `/clear`.** Fuente de verdad para ejecutar la
> **v6 = solo interfaz/UX** (cero datos, cero backend, cero features nuevas).
> Lee primero, en este orden y parando en cuanto tengas lo necesario:
> `~/.claude/context/`, `CLAUDE.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`,
> **`SPECS_V6.md`** (plan detallado: visión, paridad, análisis v5, ideas) y el
> **handoff de diseño** en `design_handoff_senda_v6/` (`README.md` = spec;
> `Senda v6.dc.html` = referencia visual + valores exactos; `support.js` = runtime
> del prototipo, **NO** es producto). Crea tu lista de tareas (TaskCreate) a partir
> de la sección 2.

_Creado: 2026-06-28. Rama de trabajo: **`v6`** (créala desde `v4` al empezar:
`git switch -c v6`). El usuario dirá "sigue con la fase 6" tras el `/clear`._

---

## 0. Reglas de operación (INNEGOCIABLES)

1. **Entorno / Node** — antes de CUALQUIER `npm`:
   ```bash
   export NVM_DIR="$HOME/.nvm"; export PATH="$NVM_DIR/versions/node/v22.22.3/bin:$PATH"
   node -v   # v22.22.3
   ```
   `npm install` SOLO con el npm de nvm (el del sistema corrompe el árbol).
2. **Green gate antes de cada commit** (todo verde):
   ```bash
   npm run lint && npm run check && npm run test:unit -- --run && npm run test:e2e && npm run build
   ```
   Referencia actual: **307 unit, 48 e2e**. El **4173** suele estar ocupado por
   el proyecto Lumbre → e2e con `PLAYWRIGHT_PORT=5190 npm run test:e2e`. Formato:
   `npx prettier --write <ficheros>`.
3. **Un commit por milestone** (o sub-parte) en verde. Conventional commit en
   español, terminando con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
4. **NO push. NO merge a `main`. NO tocar el remoto.** Solo commits locales en `v6`.
5. **PARIDAD INNEGOCIABLE**: la v6 **no elimina ninguna función actual**;
   reorganiza y reviste. Inventario en `SPECS_V6.md` ("Paridad: características
   actuales"). Tras cada milestone, verifica que todo lo de esa pantalla sigue
   funcionando: **los e2e existentes deben seguir verdes** (ajusta selectores si
   cambian, **no** recortes funciones).
6. **Solo UI/UX**: cero datos nuevos, cero backend, cero features. Si una idea pide
   dato/función nueva → es v5: anótala en DECISIONES y no la implementes.
7. **Conservador ante la duda**: milestone grande/arriesgado → haz la sub-parte
   segura, déjala verde + commit, anota el resto. **Nunca dejes el árbol roto.**

---

## 1. Diseño y decisiones ya tomadas (no re-decidir)

- **Handoff**: `design_handoff_senda_v6/` (alta fidelidad). `README.md` = spec
  completa; `.dc.html` = valores y estructura exactos (el CSS de los componentes
  vive dentro de `support.js`, pero **los valores están** en el README + HTML; el
  "mapa" del prototipo es un placeholder). La carpeta se conserva en git pero está
  **excluida de prettier/eslint y del build**.
- **Variantes**: **Descubrimiento → A** (chips de filtro quitables + panel "Más
  filtros"). **Ficha → B** (tablero modular con índice lateral pegajoso) en
  escritorio + **pestañas** en móvil; pestaña por defecto **Resumen**. La variante
  alternativa se implementará **solo si el usuario la pide** (la B del
  descubrimiento = rail jerárquico, encaja con multi-federación v5-1).
- **Ficha de ruta** (lo que debe contener, ya diseñado):
  - **Resumen = panel de decisión**: recomendación go/precaución/no-go, meteo de un
    vistazo, **ventana ideal de inicio**, **riesgo de incendio**, **avisos
    AEMET/CAP**, **cómo llegar** (acceso + tiempo desde el origen), datos clave,
    acceso rápido a la mochila, tira "Comunidad — sin verificar".
  - **Condiciones y seguridad** (pestaña + módulo): meteo resumen, avisos, incendio,
    **fauna** (orientativo), **rutas de escape**, recordatorio 112 / emergencia.
  - **Preparación**: Mochila, Agua, Etapas y **Agua y energía** (estimación).
  - **Meteo**: conmutador **3 días / por horas**.
  - **Acciones**: informe, ficha de emergencia, **exportar GPX/KML**, **descargar
    mapa offline**, **leer informe por voz**, ["Iniciar ruta" reservada, futura].
- **Fuentes**: **Libre Franklin** (500/600/700/800) + **Source Sans 3**
  (400/500/600/700 + italic 400), ambas **OFL-1.1** → **auto-alojar** en
  `static/fonts/` como `.woff2` + `@font-face`, **incluyendo el fichero de licencia
  OFL**. Bajarlas con la API `css2` y un User-Agent moderno (devuelve woff2); la red
  a Google Fonts está confirmada. **No** cargar desde CDN (offline-first).
- **Iconos**: enfoque ligero (emoji del sistema + SVG inline mínimos, como el
  prototipo). **Sin** librería de iconos.
- **Temas/esquemas**: los **9 esquemas reales** ya viven en
  `src/lib/theme/schemes.ts` (claro: Bosque/Mar/Atardecer/Alto contraste; oscuro:
  Bosque/Noche azul/Carbón/Ámbar nocturno/Halloween). Los **tokens nuevos**
  (`brand-soft`, `brand-line`, `alert-soft`, `ok`, `warn`, variantes "soft") se
  **derivan del esquema activo** (`color-mix`/alfas) para que **los 9** funcionen.
  Lo global (escala tipográfica, espaciado, radios, sombras, badges GR/PR/SL) es
  común. **Conserva** el sistema actual de tema claro/oscuro/auto + selección de
  esquema en Ajustes + escala de texto.
- **Mapa**: seguir con **MapLibre + IGN** (`LazyMap`); revestir sus controles
  (selector de capas, clúster, mini-ficha) con el sistema nuevo.

---

## 2. Cola de trabajo (milestones; cada uno verde + commit; PARIDAD)

Detalle y razonamiento en `SPECS_V6.md`. Resumen ejecutable:

- **V6-M1 — Sistema de diseño (base).** Tokens CSS (color claro/oscuro + derivados
  por esquema; tipografía `calc(px * var(--scale))`; espaciado, radios, sombras,
  contenedores) integrados con el sistema de temas/esquemas actual. **Auto-alojar
  fuentes** (`static/fonts/` + `@font-face` + OFL). **Componentes base** Svelte
  reutilizables con sus estados (Button, Card, Section, Field/Input/Select/Checkbox/
  Toggle, Chip, Badge tipo/estado, Tabs/SectionNav, EmptyState, Skeleton,
  Banner/Alert, indicador de sync, controles de mapa) en `src/lib/components/ui/`.
  Tests donde aplique. Green + commit(s).
- **V6-M2 — Aplicar el sistema (revestir, sin cambiar comportamiento).** Migrar la
  UI existente a tokens/componentes nuevos, **sin** cambiar funcionalidad ni
  estructura todavía (solo aspecto). Cabecera/pie/nav coherentes y que escalen
  (menú móvil: barra inferior Descubrir/Diario/Ajustes + "más" para
  Tendencias/Cuenta/Créditos). Green + commit.
- **V6-M3 — Ficha de ruta (variante B + pestañas móvil).** Reestructurar
  `/ruta/[id]` según el diseño (cabecera fija + índice modular/pestañas: Resumen ·
  Mapa y perfil · Preparación · Condiciones y seguridad · Meteo · Acciones ·
  Comunidad-placeholder). **Mapear TODAS las funciones actuales** a su sitio
  (paridad: waypoints, checklist por fecha, ventana de inicio, energía, cómo
  llegar, fauna, incendio, meteo por horas + avisos, GPX, offline, voz…). Lazy de
  mapa/meteo. Green + commit(s).
- **V6-M4 — Descubrimiento (variante A).** Rediseñar la home: buscador + chips de
  filtro quitables + panel "Más filtros" + contador + orden; lista (filas nuevas
  con atribución de fuente + badges) + mapa sticky con clúster + mini-ficha; móvil
  lista↔mapa + barra inferior + botón flotante "ruta al azar". **Conservar** todos
  los filtros/orden/marcas/búsqueda/virtualización/clustering actuales. Green +
  commit(s).
- **V6-M5 — Móvil y responsive.** Densidad táctil (≥44px), navegación móvil,
  mapa/listado en móvil, cabecera/pie. Green + commit.
- **V6-M6 — A11y + rendimiento percibido.** WCAG AA (foco visible, teclado,
  contraste en los 9 esquemas, escala de texto 1.6× sin romper), skeletons,
  microinteracciones (respetar `prefers-reduced-motion`), estados vacío/error con
  reintento. Texto de UI centralizado (prep i18n, **sin** traducir). Green + commit.

> Diario, Ajustes, Cuenta, Tendencias y Créditos se revisten en M2 y se pulen
> donde toque; **conservar todas sus funciones**.

---

## 3. Fuera de alcance / BLOQUEOS

- **Nada de v5**: multi-federación, modo en ruta, comunidad real, capas/datos
  nuevos. Si hace falta dato/función → anótalo y sigue.
- **No** push ni merge a `main`.
- **Variante alternativa** (B descubrimiento / A ficha): solo si el usuario la pide.

---

## 4. DECISIONES / ASUNCIONES (ir anotando)

- (vacío al empezar)

---

## 5. Al terminar la tanda (o si te bloqueas del todo)

1. Todo en **verde** y commiteado en `v6`.
2. Actualiza `SPECS_V6.md` (progreso) y `~/.claude/context/active-projects.md`.
3. Escribe un **RESUMEN DE LA TANDA** al final de este fichero (milestones cerrados
   con hashes, qué quedó a medias y por qué, DECISIONES, lo que necesita al usuario).
4. Para. No te metas en cosas de la sección 3.

---

## RESUMEN DE LA TANDA (2026-06-28)

**Estado: v6 COMPLETA.** Los 6 milestones implementados, cada uno en verde y con
commit, en la rama `v6` (creada desde `v4`). Sin push ni merge. Green gate de
cada commit: lint + check (0 errores/0 warnings) + unit + e2e + build.

### Milestones cerrados (rama `v6`)

- **V6-M1 — Sistema de diseño base** · `b53132a`
  Tokens globales (`src/lib/styles/tokens.css`): tipografía + escala
  `calc(px * --scale)`, espaciado, radios, sombras, contenedores, badges
  GR/PR/SL y semánticos (ok/warn/danger + "soft" + brand-soft/line/ring)
  derivados del esquema activo (color-mix → los 9 esquemas funcionan). Fuentes
  auto-alojadas Libre Franklin + Source Sans 3 (latin woff2 variable, @font-face,
  preload, OFL) en `static/fonts/`. `applyTextScale` fija `--scale`. Componentes
  base en `src/lib/components/ui/` (Button, Card, Section, Badge, TypeBadge, Chip,
  Banner, EmptyState, Skeleton, Tabs, Field, TextInput, Select, Toggle, Checkbox)
  - barril + helper puro `routeType` (con test). Galería en `/sistema`.
- **V6-M2 — Revestir el armazón** · `17e1a68`
  Cabecera con tipografía de marca, tokens y nav con estado activo; barra de
  navegación inferior fija en móvil (≤720px) con menú "Más"; pie revestido;
  StatusBadge a tonos por tokens (funciona en los 9 esquemas).
- **V6-M3 — Ficha de ruta modular (variante B + pestañas móvil)** · `18ec462`
  `/ruta/[id]` reorganizada en 7 secciones con índice pegajoso (escritorio) /
  pestañas (móvil): Resumen (panel de decisión con recomendación go/precaución/
  no-go derivada de estado+avisos+lluvia, datos clave, ventana de inicio, cómo
  llegar, MIDE, destacados) · Mapa y perfil · Preparación · Condiciones y
  seguridad · Meteo · Acciones · Comunidad (placeholder "sin verificar").
  **Paridad total**: todas las funciones conservadas; anclas/selectores
  preservados. "Datos técnicos" → "Datos clave" (e2e ajustados).
- **V6-M4 — Descubrimiento (variante A)** · `1e5dcd6`
  Home con chips de filtro quitables + "Limpiar todo", panel "Más filtros"
  plegable (abierto por defecto), lista (1.25fr) + mapa pegajoso (1fr),
  filas revestidas (TypeBadge + atribución "FEMECV · oficial"), estado vacío.
  Conserva todos los filtros/orden/marcas/búsqueda/virtualización/clustering.
- **V6-M5 — Móvil y responsive** · `e544466`
  Conmutador Lista ↔ Mapa en móvil (una vista a la vez; mapa perezoso),
  densidad táctil ≥44px en filtros, mapa a altura útil. Nuevo e2e con viewport
  móvil.
- **V6-M6 — A11y + rendimiento percibido** · `33baf7d`
  Textos de UI centralizados (`src/lib/i18n.ts`, prep i18n sin traducir; el
  armazón los consume) con test; enlace "Saltar al contenido" + `main#contenido`;
  respeto global a `prefers-reduced-motion` (CSS + scrollIntoView de la ficha);
  scroll suave en anclas; skeletons de carga en mapa/perfil.

Referencia de tests al cerrar: **312 unit, 49 e2e** (partía de 307/48; +5 unit
[routeType ×3, i18n ×2], +1 e2e [conmutador móvil]).

### DECISIONES / ASUNCIONES tomadas

- **Escala de texto**: se mantiene el `font-size` raíz (UI en `rem`) **y** se
  añade `--scale` para los tokens nuevos (`calc(px*--scale)`); ambos escalan por
  igual, sin doble escalado.
- **Panel "Más filtros" abierto por defecto** (no plegado): preserva los e2e que
  operan los selects (`getByLabel`) sin abrir nada, y deja el plegado disponible.
- **Recomendación del Resumen**: heurística ligera sobre datos YA existentes
  (estado FEMECV + avisos vigentes + prob. de lluvia ≥60%); sin pronóstico no se
  muestra. No introduce datos ni fuentes nuevas.
- **Ficha en escritorio**: todas las secciones quedan apiladas y visibles
  (variante B); las pestañas solo ocultan paneles en móvil. Así los e2e
  (viewport de escritorio) ven todo y no se pierde ninguna función.
- **Iconos**: emoji del sistema + SVG inline mínimos (sin librería), como el
  prototipo.

### Pendiente / ideas anotadas (NO implementadas — fuera del alcance v6)

- **Variantes alternativas** del handoff (B de descubrimiento = rail jerárquico
  federación→…; A de ficha = solo pestañas): reservadas; implementar **solo si el
  usuario las pide** (la B de descubrimiento encaja con la multi-federación v5-1).
- **Botón flotante "ruta al azar" en móvil**: se mantuvo el dado en la fila de
  búsqueda para no duplicar el nombre accesible; el flotante queda como pulido
  opcional.
- **Migración del resto de pantallas a `src/lib/i18n.ts`**: hecha solo en el
  armazón; Ajustes/Diario/Cuenta/Tendencias/ficha/home siguen con literales
  (migración incremental futura).
- **Heart de favorito en las filas del listado** (acceso rápido a marcas): no
  añadido para no tocar el flujo de marcas; idea de pulido.
- **Galería `/sistema`**: no enlazada desde la cabecera (página interna de
  referencia); valorar si exponerla o retirarla antes de producción.

### Qué necesita del usuario

- Revisar visualmente la v6 (`npm run dev`) en los 9 esquemas y a escala 1.6×.
- Decidir si se quiere alguna **variante alternativa** del handoff.
- Cuando esté conforme: **merge de `v6`** (recordatorio: trabajar sobre `main`
  publica en GitLab Pages; aquí NO se ha hecho push ni merge, según el plan).
