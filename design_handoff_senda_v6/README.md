# Handoff: Senda v6 — Sistema de diseño + pantallas clave

## Overview
Rediseño (v6) de **Senda**, una PWA offline-first (+ escritorio) para explorar y preparar
rutas de senderismo homologadas por la FEMECV en la Comunitat Valenciana. La UI está en
**español**. El foco es **descubrir → decidir → planificar → dejar la mochila lista**, no la
navegación GPS en vivo (eso es un extra futuro, mobile-first).

Este paquete documenta:
- **Entregable A** — Sistema de diseño (tokens + componentes).
- **Entregable B** — Pantallas clave: Descubrimiento, Ficha de ruta, Diario & Ajustes.

## About the Design Files
Los archivos `Senda v6.dc.html` y `support.js` son una **referencia de diseño hecha en HTML**
(un prototipo que muestra aspecto y comportamiento), **no** código de producción para copiar tal
cual. La tarea es **recrear estos diseños en el entorno del proyecto destino** (React/Vue/Svelte +
su sistema de estilos, o el framework que mejor encaje si aún no hay uno), usando sus patrones y
librerías. Tomad el HTML como fuente de verdad visual y de tokens, no como implementación final.

### Cómo abrir/renderizar la referencia
`Senda v6.dc.html` es un **Design Component**: necesita `support.js` **en la misma carpeta** para
renderizar. Para verlo: servir la carpeta con cualquier servidor estático (`npx serve .` o
`python3 -m http.server`) y abrir el `.dc.html` en el navegador. Abrir el archivo con `file://`
directamente puede no cargar `support.js` por CORS; usad un servidor local.

El propio documento es interactivo y trae conmutadores globales (arriba):
- **Tema**: Claro / Oscuro
- **Dispositivo**: Escritorio / Móvil
- **Escala de texto**: 0.8× – 1.6×
- **Navegación**: Sistema · Descubrimiento · Ficha de ruta · Diario & Ajustes

Dentro de Descubrimiento y Ficha de ruta hay además un selector de **variante (A / B)**.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios y sombras son finales.
Recrear la UI con fidelidad usando las librerías/patrones del codebase destino. El "mapa" es un
**placeholder estilizado** (textura de relieve + clústeres + traza) pensado para sustituirse por
tiles reales (p. ej. MapLibre/Leaflet); su posición, tamaño y overlays sí son indicativos.

---

## Design Tokens

### Color — Modo claro
| Token | Hex |
|---|---|
| Fondo (`--bg`) | `#fbfaf7` |
| Superficie (`--surface`) | `#ffffff` |
| Superficie alt (`--surface-alt`) | `#f4f2ec` |
| Borde (`--border`) | `#d8d4c8` |
| Texto (`--text`) | `#1a1a1a` |
| Texto tenue (`--muted`) | `#555555` |
| Marca (`--brand`) | `#1d3a2a` |
| Sobre-marca (`--on-brand`) | `#ffffff` |
| Alerta (`--alert`) | `#b3261e` |

### Color — Modo oscuro
| Token | Hex |
|---|---|
| Fondo | `#141815` |
| Superficie | `#1e2420` |
| Superficie alt | `#252c27` |
| Borde | `#3a423b` |
| Texto | `#e8e6df` |
| Texto tenue | `#a9aea5` |
| Marca | `#8fd3ae` |
| Sobre-marca | `#0c1a12` |
| Alerta | `#f2766c` |

### Badges de tipo (mismo color en claro/oscuro)
| Tipo | Fondo | Texto | Notas de contraste |
|---|---|---|---|
| GR (Gran Recorrido) | `#b3261e` | `#ffffff` | AA |
| PR (Pequeño Recorrido) | `#b8860b` | `#1a1a1a` | texto oscuro para AA |
| SL (Sendero Local) | `#2a6f4e` | `#ffffff` | AA |

Estados semánticos: `--ok` = verde SL (`#2a6f4e` / oscuro `#5fb487`),
`--warn` = ámbar PR (`#b8860b` / `#d6a93f`). Cada uno con su variante "soft" (~12–16% alpha)
para fondos de badge/banner. El botón de peligro usa fondo sólido `#b3261e` + texto blanco en
ambos temas.

### Tipografía
- **Titulares**: Libre Franklin (pesos 700/800).
- **Texto**: Source Sans 3 (400/600/700).
- Escala (a 1×, multiplicada por `--scale` = 0.8–1.6): `xs 11.5` · `sm 13` · `base 15` ·
  `md 17` · `lg 20` · `xl 25` · `2xl 32` · `3xl 42` px. Implementada como
  `calc(<px> * var(--scale))` para que la escala de texto no rompa el layout.
- Mono (cifras/tokens): `ui-monospace`.

### Espaciado, radios, elevación, contenedores
- **Espaciado**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Radios**: 6 (sm) · 10 (md) · 14 (lg) · 999 (pill).
- **Sombras**: sm `0 1px 2px`, md `0 4px 16px`, lg `0 16px 40px` (en oscuro, alfas más altas).
- **Contenedores**: 1200 (descubrimiento/sistema) · 720 (lectura/ficha/informes) · 390 (móvil).

---

## Screens / Views

### 1. Descubrimiento (home)
**Propósito:** buscar, filtrar por facetas y decidir entre ~600 rutas (escalable a miles
multi-federación).

Elementos comunes: buscador, contador de resultados, ordenación (cercanía/nombre/desnivel),
botón **"Ruta al azar"**, listado de **filas de ruta** y **mapa** con marcadores agrupados
(clúster con conteo) + **mini-ficha** al pulsar. En móvil, conmutador **Lista ↔ Mapa**, barra
inferior (Descubrir/Diario/Ajustes) y botón flotante de ruta al azar.

- **Variante A — Chips quitables:** barra de chips de filtro activos y descartables (✕) +
  botón "Más filtros" que abre el panel colapsable. Layout escritorio: lista (1.25fr) + mapa
  sticky (1fr).
- **Variante B — Panel jerárquico:** rail lateral persistente que navega la jerarquía
  **federación → territorio/provincia → comarca → tipo → dificultad** con **conteos por faceta**.
  Layout escritorio de 3 columnas: rail (262px) + lista + mapa (360px). Crecer a nuevas
  federaciones = añadir ramas, sin rehacer la pantalla.

**Fila de ruta:** miniatura 58×58 (radio 10) · badge de tipo · nombre (Libre Franklin 700) ·
meta (km / desnivel / duración / forma · lugar) · **atribución de fuente** ("FEMECV oficial" u
"OSM · sin verificar") · badge de estado (Homologado / Sin verificar) · favorito (♡).

### 2. Ficha de ruta — "banco de preparación"
**Propósito:** preparar la salida. **Cabecera fija** con resumen (badge, estado+fuente, nombre,
distancia, desnivel, duración, forma) y acciones: favorita (♡), quiero hacer (✓), registrar
salida (⌖), **Ficha de emergencia**, **Generar informe**. Se reserva visualmente la acción
primaria futura **"Iniciar ruta"** (navegación en vivo, móvil).

- **Variante A — Pestañas:** Resumen · Mapa y perfil · Preparación · **Condiciones y
  seguridad** · Meteo · Acciones. La pestaña activa cambia el panel (estado `fichaTab`, por
  defecto **`Resumen`**).
- **Variante B — Tablero modular:** índice lateral sticky + columna con todas las secciones
  apiladas (Resumen, Mapa y perfil, Preparación, Condiciones y seguridad, Meteo, Comunidad,
  Acciones).

**Resumen = panel de decisión** (vista por defecto, responde "¿hago esta ruta hoy y a qué
hora?"):
- **Recomendación** con color semántico: Adelante (verde) / Precaución (ámbar) / No recomendado
  (rojo), con motivo.
- **Meteo de un vistazo** del día (máx/mín, prob. lluvia, viento, cielo) + enlace a Meteo.
- **Ventana ideal de inicio** (franja horaria recomendada, con barra gráfica ideal/evitar).
- **Riesgo de incendio forestal** (nivel + nota, color semántico; Generalitat · orientativo).
- **Avisos AEMET/CAP** vigentes (banner de alerta con caducidad; estado vacío "sin más avisos").
- **Cómo llegar** (aparcamiento + tiempo desde el origen + enlace saliente "Cómo llegar ↗";
  acceso OSM · sin verificar).
- **Datos clave** (distancia, desnivel, duración, tipo, estado, fuente) coherentes con la cabecera.
- **Acceso rápido a Mochila** (8/11 con barra) + CTA a Preparación.
- Tira inferior **"Comunidad — sin verificar"** (función futura, no FEMECV).

**Condiciones y seguridad** (pestaña + módulo del índice): meteo resumen con enlace a la vista
completa · **avisos AEMET/CAP vigentes** con caducidad · **riesgo de incendio** · **fauna de la
zona** (etiquetada *orientativo*, fuente comunitaria sin verificar) · **rutas de escape / puntos
de salida** (OSM · sin verificar) · recordatorio de **emergencias 112 / ficha de emergencia**.

Módulos de **Preparación**: **Mochila** (checklist agrupada con progreso 8/11), **Agua en ruta**
(puntos con potable/no + fuente por punto), **Etapas** (tramos con km/desnivel/tiempo) y
**Agua y energía** (estimación orientativa: ~2,1 L y ~2 400 kcal según distancia/desnivel/clima).
**Meteo**: conmutador **3 días / por horas** (predicción AEMET, descargada offline) + aviso de
cota alta. **Acciones**: generar informe, ficha de emergencia, exportar GPX/KML, **descargar mapa
offline**, **leer informe por voz**, e "Iniciar ruta" (reservada, futura). Hay un bloque
claramente separado **"Reportes de la comunidad — sin verificar"** (función futura, no FEMECV) y
**atribución por dato** (traza FEMECV oficial vs. POIs OSM sin verificar; meteo/avisos AEMET).

Móvil: cabecera sticky compacta + tira de pestañas (incl. Seguridad) + **banner de recomendación
del día** (decisión) + tarjeta compacta de Condiciones y seguridad + barra inferior fija con la
primaria **"Iniciar ruta"** (reservada).

### 3. Diario & Ajustes (resumido)
- **Diario:** 4 estadísticas (rutas, distancia, desnivel, días), **logros** (conseguidos vs.
  bloqueados con progreso), **progreso por comarca** (barras), y un estado de **error con
  reintento** ("No se pudo sincronizar el diario").
- **Ajustes:** **Apariencia** (tema Claro/Oscuro/Auto, esquemas de color — Bosque/Roca/Mar/Alto
  contraste —, escala de texto), **Material propio** (lista editable) y **Cuenta** (perfil,
  indicador de sincronización offline, cerrar sesión).

---

## Componentes (Entregable A)
Catálogo en la sección **Sistema** del HTML, con todos los estados:
- **Botón**: primario / secundario / fantasma / peligro × normal · hover · foco · deshabilitado · cargando.
- **Tarjeta** y **Sección con cabecera**.
- **Campo de formulario**: texto, número (stepper), select, checkbox, toggle, + estado de error con mensaje.
- **Chip de filtro** (activo / quitable) y **panel de filtros colapsable**.
- **Badge de tipo** (GR/PR/SL) y **de estado** (Homologado / Sin verificar / Deshabilitado).
- **Navegación por secciones** (pestañas pill + pestañas con subrayado).
- **Fila de listado de ruta.**
- **Controles de mapa**: selector de capas, marcador de clúster con conteo, mini-ficha de previsualización.
- **Banner/aviso** (info y alerta).
- **Indicador de sincronización**: sincronizado / pendiente / sin conexión.
- **Estado vacío** y **skeleton** de carga (shimmer).

## Interacciones & comportamiento
- Conmutadores globales: tema, dispositivo, escala de texto, navegación de sección.
- Selector de variante A/B por pantalla; pestañas de la Ficha cambian el panel; toggle Lista/Mapa en móvil.
- Hover/focus con anillo de foco visible (`box-shadow: 0 0 0 3px var(--ring)`).
- **Offline-first:** estados diseñados de sin conexión, vacío, error con **reintento** y carga (skeleton).
- Animaciones: spinner (`spin .7s`), shimmer skeleton (`1.4s`), pulso del indicador pendiente.

## State Management (en el prototipo)
`theme` (light/dark), `device` (desktop/mobile), `section`, `scale` (0.8–1.6),
`discVar` (A/B), `fichaVar` (A/B), `fichaTab` (resumen/mapa/prep/**seg**/meteo/acc; por defecto
`resumen`), `meteoView` (dias/horas), `mobileView` (lista/mapa), `sync` (ok/pend/off). Datos de
ejemplo (rutas, facetas, etapas, mochila, agua, meteo, **meteoHoras**) están en la clase lógica
del `.dc.html`.

## Accesibilidad (requisito)
WCAG **AA** en claro y oscuro, foco visible, navegable por teclado, objetivos táctiles ≥44px, y
**aguantar la escala de texto hasta 1.6×** sin romper el layout. Multi-federación: facetas que
crecen + atribución por fuente. **Nada de inventar datos**: lo no verificado se etiqueta
explícitamente "sin verificar".

## Assets
Sin imágenes externas: miniaturas y mapas son placeholders CSS (tramas/relieve) a sustituir por
imágenes y tiles reales. Iconos: glifos/emoji de sistema en el prototipo — sustituir por el set de
iconos del codebase destino. No se usan marcas de terceros.

## Marca / Logo
El isotipo de **Senda** es una **senda en zigzag** (trazado de revueltas que asciende a un punto de
cumbre), centrada y llenando un contenedor redondeado. El **wordmark** es **«Senda» en Spectral
700** (serif, interletraje −2%). En la app aparece en la cabecera (barra superior) como lockup
horizontal: badge de marca + wordmark.
- Sobre fondo claro: badge verde bosque (`#1d3a2a`) + senda en blanco; el punto de cumbre usa el
  verde claro de acento (`#8fd3ae`).
- Sobre fondo oscuro: badge verde claro (`#8fd3ae`) + senda en el color sobre-marca oscuro.
- En el lockup de la app, badge `background: var(--brand)` + trazo `var(--on-brand)` resuelve el
  contraste automáticamente en ambos temas (no se usa el acento en el mark a tamaño pequeño).
- SVG del mark (viewBox `0 0 92 92`): `polyline points="20 78 70 68 24 57 68 46 26 35 64 25 46 13"`
  con `stroke-width:9`, extremos redondeados, + `circle cx=46 cy=13 r=8.5` (punto de cumbre).
- Hoja de marca completa (lockups, vertical/compacto, claro/oscuro/sobre-marca, escalado
  96→16 px, icono de app, monocromo, espacio de respeto y paleta) en **`Senda Logo.dc.html`**.
- Sin tagline. No reescalar de forma no uniforme, no recolorear el wordmark fuera de la paleta,
  no cambiar la tipografía del wordmark.

## Files
- `Senda v6.dc.html` — diseño completo (sistema + 3 pantallas, claro/oscuro, escritorio/móvil).
- `Senda Logo.dc.html` — hoja de marca (logo + wordmark, variantes y normas de uso).
- `support.js` — runtime necesario para renderizar los `.dc.html` (no es parte del producto).
