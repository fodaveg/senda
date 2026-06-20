# SPECS V3 — Pulido y mejoras menores

Backlog de pulido de la v3, una vez implementados los 7 milestones
([SPECS_V3.md](SPECS_V3.md) §12). No son funcionalidades nuevas grandes: son
remates, deudas conscientes y detalles de calidad detectados durante la
implementación. Se rige por las mismas reglas (tests por cada cambio, no romper
los existentes, sin inventar datos, motor puro). Marca cada tarea al cerrarla.

Prioridad orientativa: **[A]** alta (valor o coherencia claros), **[M]** media,
**[B]** baja (nice-to-have).

---

## 1. Material custom (V3-M6)

- [ ] **[A]** Reflejar el material custom en el **informe imprimible** y en la
      **ficha de emergencia**: hoy solo aparece en la ficha de ruta. Debe salir en
      el informe con sus avisos (`warn`) y, en el imprimible, con casilla `☐` como
      el resto de la mochila (coherencia con v2 §7).
- [ ] **[M]** Integrar el material custom en el **checklist** (v2 §7): poder
      marcarlo "en la mochila" y que persista por (ruta, fecha) como los ítems del
      catálogo.
- [ ] **[M]** Sumar el peso del material custom al **peso total** de la mochila
      (hoy el panel de material custom no aporta al cálculo de peso).
- [ ] **[B]** Editar un ítem custom ya creado (hoy solo alta/baja).
- [ ] **[B]** Reordenar/ampliar el vocabulario de atributos y sus anti-reglas
      (p. ej. `sol` con UV alto y poca sombra; `calzado` impermeable en ruta seca)
      revisando con casos de test.

## 2. Etapas (V3-M3)

- [ ] **[A]** Mapa del **padre con todas las etapas** dibujadas juntas (hoy el
      padre no tiene track propio; solo enlaza a cada etapa).
- [ ] **[M]** **Totales agregados** del padre (distancia y desnivel = suma de las
      etapas verificadas), etiquetando si falta alguna (SPECS_V3 §6).
- [ ] **[M]** Persistir `stages`/`parent_id` en el **modelo/crawler** en vez de
      derivarlo en runtime (la derivación cumple el objetivo, pero dejarlo en el
      dato lo hace explícito y auditable).
- [ ] **[B]** En el listado, **agrupar o señalar** las rutas que son etapas (hoy
      aparecen sueltas; podría colapsarse bajo su GR padre o mostrar un badge).

## 3. Mapa y capas (V3-M1 / V3-M2)

- [ ] **[M]** Añadir capa **"Callejero" (IGN Base)** al selector si se confirma su
      WMTS (hoy: Topográfico + Satélite PNOA).
- [ ] **[M]** Unificar la **persistencia de la capa de mapa** en el módulo de
      apariencia de V3-M7 (hoy va en su propia clave `senderoscv:map-layer`).
- [ ] **[M]** Recordar el estado de los **toggles de agua/POIs** (hoy se
      reinician a "visibles" en cada visita).
- [ ] **[B]** **Agrupar marcadores** (clustering) cuando haya muchos POIs/fuentes
      muy juntos.
- [ ] **[B]** Popup de POI con **distancia al track** además del km, y accesible
      por teclado (hoy el popup es solo on-hover de ratón).
- [ ] **[B]** Verificar que la **atribución** cambia correctamente al alternar a
      la capa PNOA (texto IGN/PNOA).

## 4. Descubrimiento (V3-M4)

- [ ] **[M]** Mostrar la **provincia** en la ficha y/o en el listado (hoy solo se
      usa como filtro; el dato derivado no se enseña).
- [ ] **[B]** Recordar el **origen del filtro** (provincia/comarca) entre visitas.
- [ ] (cerrado) Orden por popularidad: **descartado** — FEMECV no publica el dato
      (SPECS_V3 §13).

## 5. Apariencia (V3-M7)

- [ ] **[M]** **Previsualización** de las paletas en Ajustes (muestra de colores
      junto a cada opción) en vez de solo el nombre.
- [ ] **[M]** Revisar **modo oscuro** en todos los componentes nuevos
      (CustomGearPanel, StagesList, toggles del mapa, tooltip del perfil): contraste
      y bordes correctos en oscuro.
- [ ] **[B]** Que el toggle de la barra cicle **claro → oscuro → auto** (hoy solo
      alterna claro/oscuro; "auto" queda en Ajustes).

## 6. Datos y enriquecimiento (V3-M2)

- [ ] **[M]** Permitir **imagen/descripción manual** de POIs en
      `data/routes/_manual/<id>.json` (OSM no las trae; lo manual tendría prioridad
      y se citaría, regla v1).
- [ ] **[M]** **Deduplicar POIs** cercanos con el mismo nombre/tipo (OSM a veces
      repite nodos).
- [ ] **[M]** Reflejar **fuentes de agua y POIs en el informe** (lista con km y
      distancia), no solo en el mapa.
- [ ] **[B]** Republicar el **catálogo en Pages** (CI) con los nuevos campos para
      que la actualización en runtime los incluya (tras mergear v3 a main).
- [ ] **[B]** Revisar el **buffer de POIs** (150 m) y los tipos incluidos con una
      muestra real (¿demasiados/muy pocos?).

## 7. Calidad transversal

- [ ] **[M]** **Code-splitting** del bundle: el build avisa de chunks > 500 kB
      (MapLibre pesa). Carga diferida del mapa donde no se use.
- [ ] **[M]** **i18n** preparada (textos centralizados; valencià como primer
      candidato) — pendiente declarado desde v2 §13.
- [ ] **[B]** Tests e2e de **regresión visual** o de oscuro para los componentes
      nuevos.
- [ ] **[B]** Revisar **accesibilidad** de los marcadores del mapa (foco,
      `aria-label`, navegación por teclado de POIs).

---

## Notas

- Todo lo anterior va sobre la rama `v3`; `main` (web desplegada) no se toca hasta
  mergear. El estado y las decisiones vivas están en
  [SPECS_V3_PROGRESS.md](SPECS_V3_PROGRESS.md).
- Lo grande aplazado (cuentas, OTP, analítica central) NO está aquí: es **v4**
  (requiere backend), ver [SPECS_V3.md](SPECS_V3.md) §11.
