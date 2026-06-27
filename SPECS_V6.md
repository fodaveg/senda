# SPECS V6 — Senda: **solo interfaz gráfica (UX/UI)**

Documento de intención de la versión 6. **Premisa del usuario (2026-06-27):**
desde la v1, cada versión ha metido **más datos y más funciones** (mapa, meteo,
mochila, etapas, POIs, agua, diario, logros, cuentas, sync, analítica…), y la
**experiencia de usuario empieza a sufrir**: la ficha de ruta y el descubrimiento
acumulan demasiada información sin una jerarquía clara.

> **La v6 NO añade datos ni funcionalidad nueva.** Es un rediseño de la
> **interfaz y la arquitectura de información** para que todo lo que ya hace la app
> se entienda y se use mejor. Cero fuentes nuevas, cero backend nuevo, cero
> features nuevas. Si una idea aporta datos/función, es v5, no v6.

## Visión de producto (del usuario, 2026-06-27)

El corazón de Senda es la **exploración y la preparación** de rutas (descubrir,
decidir, planificar y llevar la mochila lista) — **no** la navegación en vivo. El
**"modo en ruta" (V5-2) es un nice-to-have** y, cuando llegue, se optimizará
**para móvil**, no para escritorio. Por tanto la v6 prioriza:

1. **Descubrimiento** excelente y **escalable** (preparado para multi-federación).
2. **Ficha de ruta = banco de preparación** claro y modular (mochila, agua, meteo,
   etapas, informe, emergencia, checklist).
3. "En ruta" queda como **patrón secundario mobile-first** reservado, sin
   condicionar el diseño de escritorio.

## Por qué v6 antes (o después) de v5

- La **idea estrella de v5 (V5-1, multi-federación)** _multiplica_ los datos
  (miles de rutas de varias federaciones) y _ya incluye_ un rediseño del
  descubrimiento. Hacer una **base de UX sólida primero** evita rediseñar dos
  veces y da el armazón sobre el que v5-1 añade la capa "federación/territorio".
- v6 es **bajo riesgo**: pura capa de presentación, sin permisos nuevos
  (a diferencia de V5-2 "modo en ruta"), sin almacenamiento/moderación
  (V5-3), sin multiplicar licencias (V5-1). No toca la lógica de negocio pura.
- La app **aún no sale a producción**: momento ideal para refactor de UX sin
  presión.

## Principios (heredados, innegociables)

Offline-first; lógica de negocio pura sin Svelte; no inventar datos; zod en los
límites; degradación elegante; datos de usuario nunca se pierden. **Toda la
funcionalidad actual se conserva**: v6 reorganiza y reviste, no recorta capacidades
(si algo se "esconde", es progresivo, nunca se elimina).

## Paridad: características actuales (mínimo innegociable)

La v6 **conserva como mínimo TODO** lo que la app hace hoy. Inventario para que la
auditoría verifique que nada se pierde (reorganizar/revestir sí, recortar no):

- **Descubrimiento (home)**: listado + mapa + buscador; filtros (tipo,
  distancia, desnivel, circular, provincia, marcas, estado, con agua, alta
  sombra); orden por nombre/cercanía; botón "dado" (ruta al azar); marcadores con
  **clustering**; mini-ficha de previsualización; recordar filtro provincia/comarca;
  virtualización del listado.
- **Ficha de ruta**: mapa (track, pins inicio/fin, agua, POIs, waypoints propios,
  selector de capa IGN); **perfil de elevación** con tooltip + sincronía con el
  mapa; **meteo** (Open-Meteo/AEMET, por horas, avisos CAP); **motor de mochila**
  (material base + material custom con avisos); estimación de **agua** y de
  **energía/calorías**; **ventana ideal de inicio**; **etapas** (relación padre↔etapa);
  **marcas** (favorita/me gusta/quiero hacer) y **diario de salidas**; **checklist**
  por fecha; **informe** Markdown/imprimible/voz; **ficha de emergencia**; **cómo
  llegar** (OSRM); **fauna**; **riesgo de incendio**; **descarga de mapa offline**.
- **Diario**: estadísticas, **logros**, progreso por comarca, export Markdown.
- **Ajustes**: clave AEMET, vault, origen habitual, **apariencia** (tema
  claro/oscuro/auto + esquemas de color + escala de texto), peso, **material
  custom** (alta/edición/baja), descarga offline por lote, datos de emergencia,
  **opt-in de analítica**, modo debug, **actualización de catálogo**.
- **Cuenta**: entrar/crear/recuperar/**OTP**/backoffice/**borrar cuenta**; indicador
  de **sincronización**.
- **Tendencias**: rankings anónimos. **Créditos/licencias**.
- **Transversal**: PWA offline-first, escritorio Tauri, temas y escala de texto,
  degradación elegante de todo lo online.

## Análisis preliminar de la v5 (la v6 tiene que poder acomodarla)

La v6 rediseña la presentación, así que su arquitectura de información (IA) debe
**reservar sitio** para lo que llegue en la v5; si no, habría que re-arquitecturar.
La v5 aún no tiene hilo elegido (`SPECS_V5.md`), así que la v6 se diseña para
absorber lo **estructuralmente más exigente** y dejar **puntos de extensión** para
el resto. Por hilo de v5, lo que toca la UX:

- **V5-1 multi-federación (la más probable y la que más cambia la UX)**: cada ruta
  llevará `federacion`/`source`; el descubrimiento pasa de "lista plana + fila de
  filtros" a **navegación jerárquica / por facetas** (federación → territorio →
  provincia → comarca → tipo → dificultad) y **búsqueda federada**. → **Gancho
  v6**: descubrimiento basado en **facetas escalables** (no una fila fija de
  selects) y **atribución por fuente** visible en tarjeta y ficha.
- **V5-2 modo "en ruta" (GPS en vivo)**: navegación a pantalla completa, aviso de
  desvío, próximos POIs/agua, perfil/distancia restantes, compartir ubicación,
  **botón 112** con la ficha de emergencia, grabar track. → **Gancho v6**: en la
  ficha, una **acción primaria "Iniciar ruta"** y un **patrón de pantalla
  completa**; elevar la affordance de emergencia/112.
- **V5-3 comunidad**: partes de estado de ruta, valoraciones, fotos, GPX de
  usuario. → **Gancho v6**: en la ficha, un bloque **"reportes de la comunidad
  (sin verificar)"** claramente separado del dato oficial FEMECV, y sitio para
  **valoraciones**.
- **V5-4 planificación**: agenda de salidas, "rutas para hoy", multi-día,
  **listas/colecciones**. → **Gancho v6**: un concepto de **colecciones/listas**
  que generaliza las marcas actuales, y una superficie de **planificador/agenda**.
- **V5-5 más capas de datos**: transporte público a inicios, refugios, espacios
  protegidos, restricciones, relieve offline. → **Gancho v6**: un **selector de
  capas/overlays del mapa que escale** a muchas capas (hoy solo cambia la base).
- **V5-6 plataforma (móvil nativo, paquetes de región)**: → **Gancho v6**: el
  **responsive/móvil** de la v6 es la base; pensar en gestos y densidad táctil.
- **V5-7 a11y + i18n**: → **Gancho v6**: dejar el **texto de UI listo para i18n**
  (centralizable) aunque no se traduzca aún, y cerrar WCAG.

**Recomendación**: diseñar la v6 con el **descubrimiento por facetas** y la **ficha
modular** como ejes (cubren V5-1 y V5-3/4), y reservar el **patrón pantalla
completa + acción "Iniciar ruta"** para V5-2. Así la v6 vale para cualquier hilo
de v5 que elijas, sin rehacerla.

## Diagnóstico de la deuda de UX (a confirmar con auditoría)

- **Ficha de ruta** (`/ruta/[id]`): es la pantalla más cargada — mapa, perfil,
  meteo, mochila + material custom, etapas, POIs, agua, waypoints, informe,
  emergencia, marcas/diario… todo en una columna larga. Falta jerarquía,
  agrupación y navegación interna.
- **Descubrimiento** (home): filtros densos en una fila + listado + mapa; con
  ~600 rutas (y muchas más en v5) el patrón "todo a la vez" se queda corto.
- **Sistema visual**: hay tokens de tema y esquemas de color, pero falta un
  **sistema de componentes** coherente (espaciados, tipografía, tarjetas,
  botones, estados vacíos, jerarquía) aplicado de forma uniforme.
- **Móvil**: el terreno natural es el móvil; revisar densidad, toque, y que el
  mapa/listado convivan en pantallas pequeñas.

## Alcance propuesto (milestones, cada uno verde + commit)

> Subdividida para poder parar tras cualquier hito sin dejar la app a medias.

- **V6-M1 — Auditoría UX + arquitectura de información.** Inventario de pantallas y
  de todo lo que muestra cada una; mapa de jerarquías y agrupaciones; decisiones de
  IA (qué va primero, qué se agrupa, qué se difiere a un panel/pestaña). Entregable:
  documento + propuestas (con bocetos ASCII/mockups para elegir). _Sin código._
- **V6-M2 — Sistema de diseño.** Tokens (espaciado, tipografía, radios, sombras),
  componentes base reutilizables (Card, Section, Button, Field, EmptyState,
  Badge…), y guía de uso. Refactor incremental de la UI existente sobre ellos, sin
  cambiar comportamiento.
- **V6-M3 — Rediseño de la ficha de ruta.** Reorganizar en bloques con jerarquía
  y navegación interna (p. ej. resumen arriba; mapa+perfil; preparación
  —mochila/agua/etapas—; meteo; acciones —informe/emergencia/marcas—). Lazy de lo
  pesado (ya hay `LazyMap`).
- **V6-M4 — Rediseño del descubrimiento (home).** Mejor relación mapa↔listado,
  filtros más legibles (agrupados/colapsables), estados vacíos y de carga
  cuidados. Compatible con la escala ya hecha en v4-M6 (índice ligero,
  virtualización por `content-visibility`, búsqueda precomputada, clustering).
- **V6-M5 — Móvil y responsive.** Densidad táctil, navegación en pantallas
  pequeñas, mapa/listado en móvil, cabecera/pie.
- **V6-M6 — Pulido de accesibilidad y rendimiento percibido.** Cierra lo que quede
  de WCAG (PRE-C/V5-7: foco, lectores, contraste —ya hay esquemas y escala de
  texto—), microinteracciones, skeletons, transiciones.

## Ideas de UX adicionales (todas las que considero)

Más allá de reorganizar, ideas que mejoran la experiencia **sin añadir datos ni
fuentes** (si una idea pidiera dato nuevo, sería v5):

- **Ficha de ruta navegable**: cabecera fija con resumen (tipo, distancia,
  desnivel, duración, estado) + **navegación por secciones** (índice/anclas o
  pestañas: Mapa · Preparación · Meteo · Etapas · Acciones), para no scrollear un
  muro. **Acción primaria clara** ("Iniciar ruta" reservado a V5-2; hoy "Generar
  informe"/"Marcar"). Lazy de meteo/mapa al entrar en su sección.
- **Descubrimiento por facetas**: filtros como **chips activos** visibles y
  quitables, panel de filtros colapsable, contador de resultados en vivo, "limpiar
  todo". Vista **lista ↔ mapa** conmutable en móvil. Preparado para jerarquía v5-1.
- **Estados vacíos y de carga con cuidado**: skeletons del listado/ficha, mensajes
  de estado vacío útiles (sin resultados → sugerir quitar filtros), errores de lo
  online con reintento (ya hay degradación; falta el reviste).
- **Onboarding ligero** la primera vez (qué es homologado, qué es "sin verificar",
  cómo funciona la mochila), descartable y revisitable desde Ajustes.
- **Búsqueda mejor**: caja de búsqueda con sugerencias (municipio/comarca/ruta),
  historial reciente, y atajos de teclado (`/` para buscar).
- **Jerarquía visual y tipográfica**: escala de tamaños/contraste coherente,
  tarjetas uniformes, iconografía consistente (ya hay emojis sueltos → unificar).
- **Densidad configurable** (cómoda/compacta) reutilizando la escala de texto.
- **Comparar rutas** (2–3 lado a lado) usando solo datos ya existentes.
- **Mapa**: leyenda de marcadores, selector de capas/overlays **escalable** (base
  - datos: agua/POIs/…); popup con **distancia al track** (estaba en backlog v3).
- **Marcas → colecciones**: generalizar favoritas/quiero-hacer a **listas
  propias** (base para V5-4), reordenables, con estado vacío claro.
- **Coherencia de navegación**: cabecera/menú que escale (hoy enlaces sueltos),
  migas o "volver" consistentes, y un menú móvil.
- **Microinteracciones discretas** (no decorativas): feedback al marcar, al
  sincronizar, al copiar; respeto a `prefers-reduced-motion`.
- **Texto de UI centralizado** (prep i18n, V5-7) aunque no se traduzca aún.

## Flujo con Claude Design (cómo lo usamos juntos)

Dos formas de trabajar la v6, a tu elección:

1. **Con Claude Design** (recomendado para fijar estética y sistema): tú o yo
   exploramos el rediseño visual y el **sistema de diseño** (tokens + componentes)
   en Claude Design; con `DesignSync`/`/design-sync` **bajo y sincronizo** ese
   sistema con la librería local, y lo **implemento en Svelte** sobre la app real.
   Claude Design da el _diseño_; yo doy la _app construida_.
2. **Solo en código** (si prefieres no pasar por Design): hago auditoría + IA +
   bocetos (ASCII / opciones lado a lado para elegir) y lo implemento directamente.

En ambos casos, cada milestone termina en verde (lint/check/tests/build) y
**conserva toda la funcionalidad** (sección de Paridad).

## Fuera de alcance (explícito)

Cualquier dato/fuente nueva, multi-federación (v5-1), modo en vivo/GPS (v5-2),
comunidad/fotos (v5-3), nuevas capas (v5-5), móvil **nativo** (v5-6 — aquí solo
responsive web/PWA), i18n (decisión aparte; v5-7/PRE-D).

## Qué hace falta del usuario para la v6

Poco, comparado con v5: **decisiones de diseño** (elegir entre propuestas de IA y
estilo en V6-M1/M2) y, si quieres, una referencia de estética/marca. No requiere
backend, permisos, ni datos nuevos. Se puede ejecutar en gran parte de forma
autónoma con validaciones de diseño puntuales.

---

## Handoff de diseño recibido (2026-06-28)

Claude Design entregó `design_handoff_senda_v6/` (alta fidelidad: tokens,
tipografía, componentes con estados y 3 pantallas con variantes). Se conserva en
git como **referencia visual**; excluido de prettier/eslint y del build (no es
código del producto). Fuentes: **Libre Franklin + Source Sans 3** → se
**auto-alojan** (offline-first), no desde CDN.

### Variantes (anotadas; la alternativa se puede pedir según evolucione la v5)

El handoff trae dos variantes por pantalla. **Se implementa primero:**

- **Descubrimiento → variante A** (chips de filtro quitables + panel "Más
  filtros"). La **variante B** (rail jerárquico federación→…→dificultad, 3
  columnas) queda **reservada**: es la natural cuando llegue la **multi-federación
  (V5-1)**; se puede pedir su implementación entonces sin rehacer la pantalla.
- **Ficha de ruta → variante B** (tablero modular con índice lateral pegajoso) en
  escritorio + **pestañas** en móvil. La **variante A** (solo pestañas) queda
  reservada como alternativa.

### Huecos detectados (paridad): features sin sitio explícito en el handoff

El diseño cubre mochila, agua, etapas, meteo (3 días + aviso de cota), informe,
emergencia y el bloque futuro de comunidad. **No tiene slot** para features que
**ya existen** y que la v6 debe conservar:

- **Ventana ideal de inicio** (a qué hora salir) — info de decisión.
- **Estimación de energía/calorías**.
- **Cómo llegar al inicio** (acceso/aparcamiento, OSRM).
- **Fauna** de la zona y **riesgo de incendio forestal**.
- **Meteo por horas** y **avisos CAP de AEMET** (el diseño solo muestra 3 días).
- **Descarga de mapa offline** y **lectura por voz** del informe (→ Acciones).

**Recomendación (a confirmar/pasar a Design):** enriquecer el **"Resumen"** de la
ficha como un **panel de decisión** (meteo de un vistazo + ventana de inicio +
riesgo de incendio + acceso + go/no-go), ya que el producto va de **decidir**.
Si se quiere diseñado, pedir a Design una variante de Resumen enriquecido y un
módulo "Condiciones y seguridad"; si no, se ubican estos elementos dentro de las
secciones existentes durante la implementación (no bloquea).

### Esquemas de color — sin dependencia de Design

Los **9 esquemas reales** ya viven en el código (`src/lib/theme/schemes.ts`):
claro = Bosque/Mar/Atardecer/Alto contraste; oscuro = Bosque/Noche azul/Carbón/
Ámbar nocturno/Halloween. (La lista del handoff —Bosque/Roca/Mar/Alto contraste—
era **ilustrativa**.) Los **tokens nuevos** del sistema (p. ej. `brand-soft`,
`brand-line`, `alert-soft`, `ok`/`warn`) se **derivan del esquema activo** (vía
`color-mix`/alfas) para que **todos los esquemas** funcionen con el nuevo sistema;
lo global (escala tipográfica, espaciado, radios, sombras, badges GR/PR/SL) es
común. **No hace falta pedir nada a Design sobre los esquemas.**
