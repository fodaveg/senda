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

## Fuera de alcance (explícito)

Cualquier dato/fuente nueva, multi-federación (v5-1), modo en vivo/GPS (v5-2),
comunidad/fotos (v5-3), nuevas capas (v5-5), móvil **nativo** (v5-6 — aquí solo
responsive web/PWA), i18n (decisión aparte; v5-7/PRE-D).

## Qué hace falta del usuario para la v6

Poco, comparado con v5: **decisiones de diseño** (elegir entre propuestas de IA y
estilo en V6-M1/M2) y, si quieres, una referencia de estética/marca. No requiere
backend, permisos, ni datos nuevos. Se puede ejecutar en gran parte de forma
autónoma con validaciones de diseño puntuales.
