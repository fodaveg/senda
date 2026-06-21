# SPECS V3.5 — Senderos CV

Bloque intermedio entre [SPECS_V3.md](SPECS_V3.md) (mapa/datos/temas) y la v4
(cuentas/backend). Son **funcionalidades 100% offline** centradas en **estar en
ruta, el diario y la planificación** — no necesitan servidor, así que entran
antes de la v4. Deltas sobre v1–v3; todo lo no modificado sigue vigente.

**Principios (heredados):** offline-first; lógica de negocio **pura y sin imports
de Svelte**; **no inventar datos** (dato no verificado → nada, nunca un valor
falso); zod en los límites; tests por cada función nueva; cada milestone termina
en verde con un commit.

> Geolocalización: en la app de escritorio (Tauri) es limitada (ya documentado);
> estas funciones de GPS degradan con elegancia y brillan en web/PWA y móvil.

---

## 1. Motor de mochila: agua y comida cuantificadas (V3.5-M1)

Hoy el motor dice "lleva agua extra"; ahora **estima litros**.

- Función **pura** `waterEstimate(route, weather, durationMin) → { litros, motivo }`:
  base por hora de actividad, +incremento por calor (`temperature_2m_max`) y por
  desnivel, −descuento si hay fuentes fiables en ruta. Rango con margen, siempre
  con el método citado (no es una verdad, es una estimación).
- **Calorías estimadas** `energyEstimate(route, pesoUsuario?) → kcal` por
  distancia + desnivel (MET de senderismo). Peso del usuario opcional (ajustes);
  sin él, estimación genérica etiquetada.
- Se muestran en el panel de mochila y en el informe, marcadas como estimación.

## 2. Perfil de elevación: pendiente y tramos duros (V3.5-M2)

- Cálculo **puro** de **pendiente (%)** por tramo a partir del perfil ya existente.
- Coloreado del perfil por dureza (suave/media/dura) y resaltado de las rampas más
  exigentes; tooltip muestra el % además de km/altura.
- Sin datos nuevos: deriva del track.

## 3. Mapa: relieve, waypoints propios y descarga por lote (V3.5-M3)

- **Capa de relieve sombreado del IGN** añadida al selector (WMTS, como Callejero).
- **Waypoints propios** [local]: el usuario marca puntos ("coche aquí", "fuente
  vista", "desvío") sobre el mapa; se guardan por ruta en localStorage versionado
  y se pintan con su nota. (Sincronizables en v4.)
- **Descarga offline por lote**: bajar los tiles de varias rutas a la vez (las
  marcadas "quiero hacer", o una comarca), reutilizando el motor de descarga de
  v2 §11 con el mismo tope de cortesía con el IGN.

## 4. Diario: logros, progreso y exportación (V3.5-M4)

- **Estadísticas ampliadas** (puras): **% de comarcas completadas**, desglose por
  tipo/año ya existe; añadir **mapa de calor** de zonas hechas sobre el mapa.
- **Logros** derivados del diario: "todas las de \<comarca\>", "N GR completos",
  hitos de km/desnivel acumulado. Cálculo puro y testeado.
- **Exportar una salida a GPX** (de las grabadas en M6) y el diario ya exporta a
  Markdown (v2 §8).

## 5. Descubrimiento: filtros útiles y mejor día (V3.5-M5)

- **Filtros "apto para"** sobre datos **derivables** (sin inventar): con agua
  (water_points), circular, **alta sombra** (`shade_ratio`), por rango de
  distancia/desnivel. Lo no verificable (niños/perros/accesible) **no se ofrece**
  hasta tener el dato (criterio de salida, como en v3 §13).
- **"Mejor día"**: con el pronóstico a 7 días (Open-Meteo) sugerir el día más
  favorable para una ruta (menos lluvia/calor extremo dentro de la ventana).
- **Rutas que enlazan**: proponer combinaciones de PR-CV/SL-CV cuyos extremos
  estén próximos (deriva de bbox/extremos del track).

## 6. En ruta: grabación, desvío, ritmo y luz (V3.5-M6 — la grande)

La función estrella de seguridad. Todo **offline**, con permiso explícito de
geolocalización y **sin persistir la posición salvo la grabación que el usuario
inicia**.

- **Grabar la salida** [local]: `watchPosition` traza tu recorrido; se ve sobre el
  mapa; al terminar genera un **GPX** y una salida del diario (con duración real).
- **Alerta de desvío** (puro): distancia mínima de tu posición al track oficial;
  si supera un umbral, aviso "te has alejado N m de la ruta". Reutiliza el
  haversine y la geometría existentes.
- **Ritmo y ETA en vivo** (puro): velocidad real → tiempo estimado a meta.
- **Luz dinámica** (puro): combina ritmo real + distancia restante + `sunset`
  (ya tienes la ventana de inicio) → "a tu ritmo, terminas con/ sin luz".
- **Acción 112** rápida: botón que muestra tus **coordenadas actuales** listas
  para leer/copiar (amplía la ficha de emergencia de v2 §9).

## 7. Usabilidad (V3.5-M7)

- **Tamaño de texto** ajustable (token de escala; persistido en apariencia).
- **Lectura por voz** del informe/mochila con la Web Speech API (offline del
  navegador), para preparar la salida sin mirar la pantalla.

---

## 8. Milestones (orden propuesto, de menor a mayor riesgo)

**Estado: M1–M7 COMPLETADOS** (rama `v3`, todo en verde). Único pendiente
anotado: "rutas que enlazan" (M5) requiere coordenadas de fin en el modelo
(re-ingesta) para no inventar enlaces.

Cada uno termina con tests en verde y un commit; no se avanza con tests en rojo.

1. **V3.5-M1 — Mochila cuantificada**: litros de agua + calorías (puro) en panel e
   informe.
2. **V3.5-M2 — Pendiente en el perfil** (puro).
3. **V3.5-M3 — Mapa**: relieve IGN + waypoints propios + descarga por lote.
4. **V3.5-M4 — Diario**: logros + % comarcas + mapa de calor.
5. **V3.5-M5 — Descubrimiento**: filtros "apto para" + mejor día + enlaces.
6. **V3.5-M6 — En ruta**: grabación GPS + desvío + ritmo/ETA + luz dinámica + 112
   - export GPX.
7. **V3.5-M7 — Usabilidad**: tamaño de texto + lectura por voz.

## 9. Buenas prácticas (añadidos)

- Toda estimación (agua, calorías, ETA, luz) **etiquetada como estimación** con su
  método; nunca presentada como dato verificado.
- Geolocalización solo bajo gesto del usuario; la posición no se envía a terceros;
  solo se guarda la **grabación** que el usuario inicia explícitamente.
- Funciones de cálculo (agua, pendiente, desvío, ritmo, luz, logros) **puras y
  testeadas**, sin imports de Svelte.
- Los datos nuevos de usuario (waypoints, grabaciones, ajuste de texto) en
  localStorage **versionado** y **anonimizables/exportables** (preparados para la
  sincronización de v4).
