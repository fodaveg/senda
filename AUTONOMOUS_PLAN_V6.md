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

## RESUMEN DE LA TANDA (rellenar al acabar)

- (pendiente)
