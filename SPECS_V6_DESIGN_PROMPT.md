# Prompt para Claude Design — Rediseño UI/UX de Senda (v6)

> Pega el bloque de abajo en Claude Design (con un proyecto de **Design system**).
> Está pensado para producir primero el sistema de diseño y luego las pantallas
> clave. Yo (Claude Code) implementaré el resultado en el repo y lo sincronizaré
> con `/design-sync`.

---

Eres un diseñador de producto. Diseña el **sistema de diseño** y las **pantallas
clave** del rediseño (v6) de **Senda**, una app de senderismo.

## Qué es Senda

App para **explorar y preparar** rutas de senderismo homologadas por la FEMECV en
la Comunitat Valenciana. **PWA offline-first** + app de escritorio. **UI en
español**. Un solo producto, uso personal y, a futuro, abierto. El corazón es
**descubrir, decidir, planificar y dejar la mochila lista**, NO la navegación GPS
en vivo (eso es un extra futuro, y será mobile-first).

## Problema a resolver (objetivo del rediseño)

Desde la v1 se ha ido acumulando funcionalidad y datos (mapa, meteo, mochila,
etapas, POIs, agua, diario, logros, cuentas…) y la interfaz **ha perdido jerarquía
y se ha saturado**, sobre todo la **ficha de ruta** (un muro de secciones en una
columna) y el **descubrimiento** (fila densa de filtros). Necesito:

1. Una **arquitectura de información clara** con jerarquía visual.
2. Un **descubrimiento escalable** (hoy ~600 rutas; a futuro **miles** de varias
   federaciones).
3. Una **ficha de ruta modular** tipo "banco de preparación".
4. Un **sistema de componentes coherente** y **modo claro y oscuro**.
5. **Responsive** real (escritorio y móvil).

**Importante: no se elimina ninguna funcionalidad; se reorganiza y reviste.**

## Marca y estética

Naturaleza y montaña; **sereno, fiable, legible** (se usa también al aire libre, a
pleno sol y con prisas). Nada recargado. Tipografía muy legible. Paleta "bosque":

- **Claro** — fondo `#fbfaf7`, superficie `#ffffff`, superficie alt `#f4f2ec`,
  borde `#d8d4c8`, texto `#1a1a1a`, texto tenue `#555`, **marca** `#1d3a2a`,
  sobre-marca `#ffffff`, alerta `#b3261e`.
- **Oscuro** — fondo `#141815`, superficie `#1e2420`, borde `#3a423b`, texto
  `#e8e6df`, texto tenue `#a9aea5`, **marca** `#8fd3ae`, sobre-marca `#0c1a12`.
- **Badges de tipo de sendero**: GR `#b3261e`, PR `#b8860b`, SL `#2a6f4e`.

Soporta **varios esquemas de color** (variantes de la marca) y **escala de texto
0.8×–1.6×**: el diseño no debe romperse con texto grande.

## Entregable A — Sistema de diseño

- **Tokens**: color (claro + oscuro), tipografía (escala de tamaños y pesos),
  espaciado, radios, sombras/elevación, anchos de contenedor.
- **Componentes** (con variantes y estados —normal, hover, foco, deshabilitado,
  cargando, vacío—):
  - Botón (primario, secundario, fantasma, **peligro**).
  - Tarjeta / Sección con cabecera.
  - Campo de formulario (texto, número, select, checkbox, toggle).
  - **Chip de filtro** (activo, quitable) y panel de filtros colapsable.
  - **Badge** de tipo (GR/PR/SL) y de **estado** (homologado, sin verificar,
    deshabilitado).
  - Navegación por secciones / pestañas (para la ficha).
  - Fila de listado de ruta (compacta y cómoda).
  - Controles de mapa (selector de capas, marcador de **clúster** con conteo,
    mini-ficha de previsualización).
  - Banner/aviso (meteo/incendio), indicador de **sincronización**
    (sincronizado/pendiente/sin conexión), estado **vacío** y **skeleton** de carga.

## Entregable B — Pantallas clave (claro y oscuro, escritorio y móvil)

1. **Descubrimiento (home)**: buscador; **filtros por facetas** mostrados como
   chips quitables + panel colapsable (tipo, distancia, desnivel, circular,
   provincia/comarca, marcas, estado, con agua, alta sombra; orden por
   nombre/cercanía); **contador de resultados**; **listado** de rutas +
   **mapa** con marcadores agrupados (clúster) y mini-ficha al pulsar; botón
   "ruta al azar". En **móvil**, conmutar **lista ↔ mapa**. Diseña los filtros
   para que **escalen a una jerarquía** (federación → territorio → provincia →
   comarca → tipo → dificultad) sin rehacer la pantalla.
2. **Ficha de ruta = banco de preparación**: **cabecera fija con resumen** (nombre,
   badge de tipo, estado, distancia, desnivel, duración) y **navegación por
   secciones**: _Resumen · Mapa y perfil · Preparación (mochila, agua, etapas) ·
   Meteo · Acciones_. Acciones: generar informe, ficha de emergencia, marcar
   (favorita/quiero hacer/registrar salida); reserva sitio para una **acción
   primaria futura "Iniciar ruta"** (mobile). Incluye un bloque claramente
   separado y etiquetado **"Reportes de la comunidad — sin verificar"** (futuro) y
   **atribución de la fuente** de cada dato (FEMECV oficial vs. OSM "sin
   verificar").
3. **Diario** (estadísticas + logros + progreso por comarca) y **Ajustes**
   (apariencia, material propio, cuenta) — versión resumida.

## Restricciones (cúmplelas)

- **No inventar datos**: lo no verificado se etiqueta "sin verificar"; nunca
  sustituye al dato oficial.
- **Offline-first**: diseña estados de **sin conexión**, **vacío**, **error con
  reintento** y **carga (skeleton)**.
- **Accesibilidad WCAG AA**: contraste suficiente en claro y oscuro, **foco
  visible**, navegable por teclado, **objetivos táctiles grandes**, y que todo
  aguante la **escala de texto** hasta 1.6×.
- **Escalable a multi-federación**: facetas que crecen y **atribución por fuente**
  por ruta.
- **Español** en toda la interfaz.

## Formato de salida

Sistema de diseño (tokens + componentes) y diseños de pantalla **anotados**,
**responsive** (escritorio + móvil) y en **modo claro y oscuro**.

---

# Prompt 2 — Iteración de la Ficha de ruta (Resumen enriquecido + Condiciones y seguridad)

> Pégalo en el **mismo proyecto** de Claude Design (continúa el diseño de Senda v6).

---

Continúa el diseño de **Senda v6** que ya hiciste (mismo **sistema de diseño,
tokens, componentes y variantes**; claro/oscuro; escritorio/móvil; español; WCAG
AA; offline-first; etiquetar lo no oficial como "sin verificar"). Revisa la
**Ficha de ruta**: su vista por defecto se queda corta para **decidir**. Añade lo
siguiente.

## 1) "Resumen" enriquecido = panel de decisión

La vista **Resumen** debe ser lo primero y responder de un vistazo: _"¿hago esta
ruta hoy y a qué hora?"_. Incluye, con jerarquía clara:

- **Recomendación go / precaución / no-go** (etiqueta con color semántico) según
  las condiciones.
- **Meteo de un vistazo** del día elegido (máx/mín, prob. de lluvia, viento,
  cielo) con enlace a la sección de meteo completa.
- **Ventana ideal de inicio** (franja horaria recomendada para salir).
- **Riesgo de incendio forestal** (nivel + nota breve, con su color).
- **Avisos AEMET/CAP** vigentes (banner de alerta si los hay; estado vacío si no).
- **Cómo llegar al inicio** (acceso/aparcamiento + tiempo estimado desde el origen
  del usuario; enlace saliente "Cómo llegar").
- **Datos clave** (distancia, desnivel, duración, tipo, estado, fuente), coherente
  con la cabecera fija.
- **Accesos rápidos**: estado de la mochila (p. ej. 8/11) con CTA a _Preparación_.

## 2) Módulo nuevo "Condiciones y seguridad"

Una sección (en el índice modular **y** como pestaña) que agrupe la seguridad:

- **Meteo** por días + **por horas** del día elegido.
- **Avisos AEMET/CAP** (vigentes, con caducidad).
- **Riesgo de incendio forestal**.
- **Fauna** de la zona (qué puedes encontrar / precauciones), etiquetada como
  orientativa.
- **Rutas de escape / puntos de salida** si existen.
- Recordatorio de la **ficha de emergencia / 112**.

## 3) Ajustes a módulos existentes (para no perder funciones)

- **Preparación**: añade un bloque de **estimación de agua y de energía/calorías**
  (junto a Mochila / Agua / Etapas).
- **Acciones**: añade **descargar mapa offline** y **leer informe por voz**,
  además de generar informe y ficha de emergencia.
- **Meteo**: que soporte la vista **por horas** además de los 3 días.

Mantén las **dos variantes** donde apliquen, los **estados** (vacío, error con
reintento, carga/skeleton) y la **atribución por fuente** (FEMECV oficial vs.
OSM/AEMET orientativo). No inventes datos: lo no verificado va etiquetado.
