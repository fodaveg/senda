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

- [x] **[A]** Material custom en el **informe imprimible**: sale en la sección
      "Mochila recomendada" como "Tu material" con su aviso (`warn`) y casilla `☐`
      (report/model.ts + informe). (La ficha de emergencia es para contactos/ruta,
      no para equipo: no aplica.)
- [ ] **[M]** Integrar el material custom en el **checklist** (v2 §7): poder
      marcarlo "en la mochila" y que persista por (ruta, fecha) como los ítems del
      catálogo.
- [x] **[M]** Peso del material custom sumado al **peso total** de la mochila
      (BackpackPanel).
- [ ] **[B]** Editar un ítem custom ya creado (hoy solo alta/baja).
- [ ] **[B]** Reordenar/ampliar el vocabulario de atributos y sus anti-reglas
      (p. ej. `sol` con UV alto y poca sombra; `calzado` impermeable en ruta seca)
      revisando con casos de test.

## 2. Etapas (V3-M3)

- [x] **[A]** Mapa del **padre con todas las etapas**: YA CUBIERTO — los padres
      tienen GPX propio con el track completo (p. ej. `gr-10.gpx` = 98,7 km), así
      que el mapa de la ficha ya muestra toda la GR.
- [x] **[M]** **Totales agregados** del padre: YA CUBIERTO — distancia/desnivel
      del padre vienen de su GPX completo (son los totales reales).
- [ ] **[M]** Persistir `stages`/`parent_id` en el **modelo/crawler** en vez de
      derivarlo en runtime (la derivación cumple el objetivo, pero dejarlo en el
      dato lo hace explícito y auditable).
- [ ] **[B]** En el listado, **agrupar o señalar** las rutas que son etapas (hoy
      aparecen sueltas; podría colapsarse bajo su GR padre o mostrar un badge).

## 3. Mapa y capas (V3-M1 / V3-M2)

- [x] **[M]** Capa **"Callejero" (IGN Base)** añadida al selector (IGNBaseTodo).
      Pendiente de confirmar en runtime que el WMTS renderiza con tu prueba.
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

- [x] **[M]** Provincia (y municipio) mostrados en "Datos técnicos" de la ficha.
- [ ] **[B]** Recordar el **origen del filtro** (provincia/comarca) entre visitas.
- [ ] (cerrado) Orden por popularidad: **descartado** — FEMECV no publica el dato
      (SPECS_V3 §13).

## 5. Apariencia (V3-M7)

- [x] **[M]** **Previsualización** de esquemas en Ajustes (cajitas de color por
      esquema) — hecho en el rediseño de temas.
- [x] **[M]** **Modo oscuro** revisado en los componentes nuevos: botones y avisos
      tokenizados (`--on-brand`, `--alert-*`); contraste correcto en todos los
      esquemas.
- [ ] **[B]** Que el toggle de la barra cicle **claro → oscuro → auto** (hoy solo
      alterna claro/oscuro; "auto" queda en Ajustes).

## 6. Datos y enriquecimiento (V3-M2)

- [ ] **[M]** Permitir **imagen/descripción manual** de POIs en
      `data/routes/_manual/<id>.json` (OSM no las trae; lo manual tendría prioridad
      y se citaría, regla v1).
- [ ] **[M]** **Deduplicar POIs** cercanos con el mismo nombre/tipo (OSM a veces
      repite nodos).
- [x] **[M]** **POIs en el informe** (lista con tipo, km y distancia) en "Puntos
      destacados"; las fuentes de agua ya salían en "Fuentes de agua y escapes".
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
