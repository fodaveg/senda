# SPECS V2 — Senderos CV

Especificación de la **versión 2** de Senderos CV. Este documento define los **deltas** sobre [SPEC.md](SPEC.md) (v1): todo lo no modificado aquí sigue rigiéndose por la v1, incluidas sus restricciones y buenas prácticas. La v1 está completa (M1–M7) y este documento no invalida ninguna de sus decisiones cerradas salvo donde se indica explícitamente.

---

## 1. Decisiones de arquitectura v2 (cerradas)

| Capa              | v1                                  | v2                                                                                                                           |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Catálogo de rutas | Estático en build (`data/`)         | **Seed empaquetado + actualizable en runtime** desde GitLab Pages (`manifest.json` versionado)                               |
| Almacén local     | —                                   | IndexedDB (web/PWA) y FS de Tauri (escritorio) para catálogo descargado, datos de usuario exportables en localStorage        |
| Módulos online    | Meteo (Open-Meteo + AEMET opcional) | + **Routing OSRM** (tiempo de viaje), + **Avisos AEMET CAP**, + **actualización de catálogo**. Misma degradación elegante    |
| Geolocalización   | —                                   | API del navegador con permiso explícito; **origen habitual configurable en ajustes como respaldo**                           |
| Datos de usuario  | Ajustes en localStorage             | + marcas, diario y checklists: localStorage con **esquema versionado** y exportación/importación JSON. Sin cuentas, sin sync |
| Ingesta           | Manual por ruta (`npm run ingest`)  | + **crawler del portal FEMECV completo** (`npm run ingest:crawl`) con estado de homologación                                 |

**Restricciones que se mantienen de v1 (innegociables):**

- Sin backend, sin base de datos en runtime. GitLab Pages es hosting estático: la app solo hace GET de ficheros.
- **Wikiloc NUNCA como fuente de datos** (sin API pública; el scraping viola sus términos). Ver §10.
- Prohibido inventar metadatos de ruta: dato no verificado → `null` + entrada en `sources`.
- Lógica de negocio pura y sin imports de Svelte; zod en todos los límites de datos externos.
- La app funciona 100% offline salvo los módulos online declarados, que degradan con elegancia (estado vacío, nunca rotura ni datos inventados).

---

## 2. Estructura del repo (módulos nuevos)

```
src/lib/
├── catalog/            # manifest, descarga de catálogo, almacén local (IndexedDB/FS Tauri)
├── user/               # marcas (favorita/me gusta/quiero hacer/hecha), diario, checklists, export/import
├── report/
│   └── emergency.ts    # modelo de la ficha de emergencia (pura, reutiliza el pipeline v1)
├── engine/
│   └── startWindow.ts  # ventana ideal de inicio (pura)
├── weather/
│   ├── hourly.ts       # pronóstico horario Open-Meteo
│   └── avisos.ts       # avisos CAP de AEMET
├── geo/
│   └── routing.ts      # tiempo de viaje OSRM + respaldo haversine
└── search.ts           # buscador full-text client-side

scripts/
├── ingest/
│   ├── crawl.ts        # listado completo del portal FEMECV + descarga GPX + ficha + estado
│   └── enrich/         # fuentes semiautomáticas (§12): OSM agua/sombra, alternativas
└── publish/            # genera manifest.json y empaqueta data/ para GitLab Pages (CI)
```

---

## 3. Modelo de datos (cambios sobre v1 §3)

```jsonc
// data/routes/pr-cv-77.json — solo campos nuevos o modificados
{
	// v1: string libre → v2: enum cerrado, mapeado desde la taxonomía real del
	// portal FEMECV (9 literales en su buscador) en cada crawl, siempre con
	// fuente y fecha en sources. El literal exacto se conserva en status_detail.
	// - homologado: "En vigor", "Control de calidad positivo"
	// - con_reservas: "Sin controles de calidad", "Control de calidad
	//   condicionado", "Control de calidad negativo"
	// - en_proceso: "En proceso de homologación", "En proceso de revisión"
	// - deshabilitado: "Cancelación temporal", "Baja / Deshomologado"
	"status": "con_reservas",
	"status_detail": "Sin controles de calidad",

	"municipality": "Chulilla", // de la ficha FEMECV; alimenta el buscador

	// Procedencia por campo (opcional): distingue el origen cuando un mismo
	// route.json mezcla fuentes. Las claves son nombres de campo.
	"field_sources": {
		"water_points": "OSM Overpass 2026-09 (no verificado en campo)",
		"shade_ratio": "estimación por cobertura arbórea OSM (método §12)"
	}
}
```

- `wikiloc_search` **no se almacena**: es un enlace derivado en runtime (§10).
- Las **marcas de usuario** viven fuera del modelo de ruta, en `src/lib/user/` (localStorage): `favorita`, `me_gusta`, `quiero_hacer`, `hecha`. No excluyentes entre sí. `hecha` admite fecha y notas y alimenta el diario (§8).
- Regla de calidad v1 intacta: la ficha oficial FEMECV es fuente verificada; los enriquecimientos automáticos (§12) se citan y se etiquetan "no verificado en campo".

---

## 4. Catálogo completo y actualización en runtime

Cubre: _importar todas las rutas disponibles_ y _botón de actualización en ajustes_.

### Crawler (`npm run ingest:crawl`)

1. Recorre el listado completo del portal senders.femecv.com (PR-CV, GR, SL-CV publicados).
2. Por ruta: descarga el GPX (Azure Blob público, verificado en v1), extrae de la ficha los campos publicados (nombre, tipo, distancia, MIDE, tiempos, municipio, **estado de homologación**) y deriva del track lo de siempre (v1 §3).
3. Lo que el portal no publica sigue la regla v1: `null` + pendiente en `sources`. El merge con `data/routes/_manual/<id>.json` se conserva: lo manual (verificado) tiene prioridad.
4. Requisitos de cortesía: rate-limit (≥1 s entre peticiones), `User-Agent` identificable del proyecto, caché local de crawl para reejecuciones (no redescargar lo no modificado).
5. Idempotente: reejecutar actualiza estados y añade rutas nuevas sin pisar datos manuales.

### Publicación (CI → GitLab Pages)

- La CI publica en Pages: la web app (`build/`) y el dataset (`data/routes/*.json`, `data/gpx/*.gpx`, `data/wildlife/*.json`, `data/gear/*.json`) junto a un `manifest.json`:

```jsonc
{
	"version": 17, // entero monótono
	"published_at": "2026-09-01T10:00:00Z",
	"files": { "routes/pr-cv-77.json": "sha256-…" } // checksum por fichero
}
```

### En la app

- Los datos empaquetados en build actúan de **seed**: la app siempre funciona sin haber actualizado nunca.
- Ajustes → **"Buscar actualizaciones de rutas"**: descarga `manifest.json`, compara `version`, baja solo los ficheros con checksum distinto al almacén local (IndexedDB en web/PWA, FS en Tauri) y muestra versión y fecha del catálogo activo.
- El loader de datos resuelve: almacén local → seed empaquetado.
- Aviso pasivo opcional al arrancar con red ("hay catálogo nuevo"), nunca descarga automática sin acción del usuario.
- Validación zod de todo lo descargado antes de aceptarlo; un fichero inválido se rechaza entero (no hay catálogos a medias).

---

## 5. Meteo v2

Añade sobre v1 §4 (que sigue vigente: Open-Meteo primaria, AEMET verificación, nunca promediar):

### Pronóstico horario

- Open-Meteo hourly (`temperature_2m`, `uv_index`, `precipitation_probability`) para el día seleccionado, mismas reglas: zod, cliente puro con `fetchFn` inyectable, caché con TTL.

### Ventana ideal de inicio (cubre _horas ideales para empezar la ruta_)

- Función **pura** `startWindow(route, weatherDay, hourly) → StartWindow | null` en `src/lib/engine/startWindow.ts`:
  - Restricción dura: `inicio + est_duration_min + margen (30 min) ≤ sunset` → **alerta de luz** si la hora elegida no cabe ("saldrías sin margen de luz: el sol se pone a las 18:05").
  - Optimización: evitar que las horas centrales de calor (franja con `temperature_2m` máxima u `uv_index ≥ 7`) coincidan con la ruta si `shade_ratio < 0.4`; preferir terminar antes de la franja o empezar después.
  - Salida: franja recomendada + razones interpoladas, mismas garantías que el motor de mochila (sin datos → `null`, nunca una recomendación inventada).
- En la UI (ficha e informe, sección "Mejor momento para empezar" de v1 §6): la ventana calculada tiene prioridad de presentación sobre el campo manual `best_start_time`, que se conserva y se muestra como "recomendación de la ficha" cuando existe.

### Avisos oficiales AEMET (CAP)

- Con api key (la misma de v1): avisos meteorológicos activos (viento, tormentas, calor, nieve…) de la **zona de avisos** correspondiente a la provincia/comarca de la ruta para la fecha seleccionada.
- Banner de alerta en ficha e informe con nivel (amarillo/naranja/rojo), fenómeno y vigencia, citando "AEMET avisos, consultado \<timestamp\>".
- Sin key o sin red: no se muestra nada (jamás un "sin avisos" no confirmado).

### Caché generalizada

- La caché por municipio con TTL de AEMET (v1.5) se generaliza: **todo cliente online** (meteo diaria/horaria, avisos, routing) cachea con TTL adecuado y storage inyectable; errores tipados (`AuthError`, `RateLimitError`) y nunca cacheados.

---

## 6. Descubrimiento de rutas (UI)

Sobre la vista listado/mapa de v1 §8:

- **Buscador** full-text client-side: nombre, municipio, comarca/zona, highlights. Normaliza acentos y mayúsculas. Sin dependencias nuevas salvo justificación expresa (el catálogo completo son cientos de rutas, no miles: un índice en memoria basta).
- **Filtro y badge de estado**: filtrar por `status`; badge visible en listado y ficha. Si `deshabilitado`, banner destacado en la ficha ("ruta deshabilitada por FEMECV — no recorrer") y exclusión por defecto del listado (mostrable con el filtro).
- **Botón dado** 🎲: abre una ruta al azar **del resultado filtrado/buscado actual** (no del catálogo entero).
- **Tiempo de viaje al inicio** (cubre _estimación desde la posición actual_):
  - Origen: geolocalización del navegador (permiso explícito, nunca se persiste la posición) con respaldo del **"origen habitual"** configurable en ajustes (texto + lat/lon). Sin ninguno de los dos, la función no aparece.
  - Routing: OSRM público (`router.project-osrm.org`, perfil coche, sin key), cliente puro + caché TTL. Etiquetado siempre como "estimación en coche".
  - Sin red u OSRM caído: se oculta (opcionalmente distancia haversine etiquetada "en línea recta").
  - Orden del listado por cercanía cuando hay origen.
- **Marcas como filtros**: favoritas / me gusta / quiero hacer / hechas (§8).

---

## 7. Mochila v2: checklist interactivo

- El panel de mochila (decisiones del motor v1, que **no cambia**) se vuelve marcable: cada ítem tiene checkbox "en la mochila".
- Persistencia por **(ruta, fecha de salida)** en `src/lib/user/`; reabrir la app recupera la preparación a medias.
- El informe imprimible lleva casillas `☐` por ítem (y refleja las ya marcadas).
- Si entre preparación e impresión cambia la meteo y con ella las decisiones, los ítems marcados que dejen de estar recomendados se conservan marcados con aviso visual (el usuario decide).

---

## 8. Marcas de usuario, diario y estadísticas

- **Marcas** (cubre _favoritos / me gusta / quiero hacer / hecha_): cuatro botones en ficha y listado. Almacenamiento en localStorage con esquema versionado (`{ schema: 1, marks: {...} }`) y migraciones explícitas entre versiones.
- **Diario**: marcar "hecha" pide fecha (por defecto hoy) y notas opcionales; una ruta puede hacerse varias veces (lista de salidas).
- **Estadísticas** (vista nueva): total de salidas, km y desnivel acumulados (de los datos verificados de cada ruta), desglose por comarca, tipo y año. Cálculo en cliente, puro y testeado.
- **Exportación**: diario a Markdown compatible Obsidian (reutiliza `src/lib/report/markdown.ts`); copia de seguridad completa de datos de usuario a JSON e importación con validación zod.

---

## 9. Ficha de emergencia (plan de aviso para contactos)

Documento pensado para **dejar a familiares o contactos antes de salir**: si no reciben tu "OK" a la hora acordada, tienen todo lo necesario para activar ayuda. Se genera desde la ficha de ruta ("Generar ficha de emergencia") reutilizando el pipeline de informes de v1 (`src/lib/report/`): un único modelo, tres salidas.

### Contenido del documento

1. **Quién va**: nombre y teléfono del senderista, acompañantes (o "voy solo/a", destacado). Opcional: datos médicos relevantes (alergias, medicación, condiciones) — solo si el usuario los rellena.
2. **La ruta**: nombre, tipo y estado, municipio, distancia, desnivel, MIDE, circular/lineal, **coordenadas del punto de inicio** (y de fin si es lineal) con enlaces abiertos a mapas (`geo:`, OpenStreetMap), enlace a la ficha FEMECV, y el **GPX adjuntable** (útil para los equipos de rescate).
3. **Vehículo** (opcional): modelo, color, matrícula y dónde quedará aparcado.
4. **Plan horario**: fecha; hora prevista de salida (la elegida o la de la ventana ideal §5); duración estimada (MIDE, etiquetada como estimación); hora estimada de fin; **"hora del OK"** (cuándo avisará de que todo va bien) y **hora límite de alarma** — sugerida automáticamente como fin estimado + margen configurable (por defecto +2 h), siempre editable.
5. **Cobertura**: aviso genérico de que durante la ruta la cobertura puede ser limitada o nula y el silencio entre salida y "hora del OK" es normal. (Sin datos de cobertura verificados no se afirma nada específico del recorrido.)
6. **Meteo prevista** del día con fuente y hora de consulta, y avisos CAP activos si los hay (§5).
7. **Instrucciones para el contacto**, en lenguaje claro: si no llega el OK a la hora límite — (1) intenta contactar; (2) si no responde, llama al **112** (funciona con cualquier cobertura y sin saldo) e indica: nombre, ruta y su identificador, coordenadas del inicio, hora de salida, vehículo y último contacto; (3) conserva este documento y el GPX para dárselos a los servicios de emergencia.
8. **Equipación visible** (opcional): colores de ropa y mochila — facilita la búsqueda visual.

### Datos personales y privacidad

- Nuevo bloque en ajustes, "Datos de emergencia" (nombre, teléfono, datos médicos, vehículo, margen de alarma): **todo opcional, solo en localStorage**, nunca se envía a ningún sitio; solo se incluye en el documento que el propio usuario genera y comparte.
- Los campos vacíos se omiten del documento (nada de "sin datos" que reste claridad).

### Salidas

- **Markdown** descargable (frontmatter Obsidian, como los informes v1) y **vista imprimible**.
- **Texto plano compacto** para mensajería (WhatsApp/SMS): se comparte con `navigator.share` donde exista, con copia al portapapeles como respaldo. En Tauri, "Guardar como…".
- Honestidad v1: toda hora derivada se marca como estimación; toda afirmación lleva fuente.

---

## 10. Wikiloc

- La restricción v1 se mantiene íntegra: **nunca fuente de datos** (la Partner API exige acuerdo comercial; el scraping viola los términos de uso).
- Nuevo en v2 — **enlaces inteligentes**: toda ficha muestra un enlace de búsqueda en Wikiloc construido en runtime con el nombre de la ruta (y coordenadas donde la URL de búsqueda lo permita), junto al `links.wikiloc` manual de v1 cuando exista. Es solo un `<a href>` saliente: cero datos de terceros en la app.

---

## 11. Mapa offline por ruta (condicionado a investigación)

**Primera tarea del milestone, con criterio de salida explícito:**

1. Investigar proveedores de tiles cuya licencia/política permita descarga por área: la política de OpenTopoMap (proveedor actual) **prohíbe la descarga masiva** — no usar para esto. Evaluar WMTS del IGN español y del Institut Cartogràfic Valencià (licencias tipo CC-BY, verificar términos exactos de uso masivo) u otros.
2. **Si hay proveedor viable**: botón "Descargar mapa de esta ruta" en la ficha — tiles del bbox ampliado a niveles de zoom acotados (p. ej. 12–15), guardados en el mismo almacén local del catálogo, con indicador de tamaño y botón de borrado. MapLibre resuelve tile local → red.
3. **Si no lo hay**: la funcionalidad se descarta documentando el porqué en este documento (sección actualizada con la evidencia). No se viola ningún término de uso "porque es cómodo".

---

## 12. Fuentes para los datos faltantes

Cubre _buscar fuentes de datos para los datos faltantes_ (los "Pendiente de verificar" de v1). Todo enriquecimiento automático se cita en `sources`/`field_sources` y se etiqueta **"no verificado en campo"**; lo manual verificado sigue teniendo prioridad.

| Campo                      | Fuente v2                                                                                           | Método                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `water_points`             | OpenStreetMap vía Overpass (`amenity=drinking_water`, `natural=spring`)                             | nodos en buffer de ~100 m del track, en ingesta           |
| `shade_ratio`              | OSM (`natural=wood`, `landuse=forest`)                                                              | % del track que interseca polígonos arbolados             |
| `alternatives`             | el propio catálogo                                                                                  | rutas con bbox a < N km, derivado automático              |
| `highlights`, `notes_rain` | ficha FEMECV ampliada + topoguías oficiales                                                         | semi-manual, con cita                                     |
| `escape_routes`            | OSM (pistas/carreteras que cruzan el track) como candidatos                                         | semi-manual: el automático solo propone, no afirma        |
| `best_season`              | sustituido funcionalmente por la ventana de inicio (§5) + climatología; el campo manual se conserva | —                                                         |
| Fauna (todas las comarcas) | **Banc de Dades de Biodiversitat de la Generalitat Valenciana**                                     | fichas por comarca con cita; cubre Marina Alta, Vinalopó… |

---

## 13. Pulido de oficio

- **Modo oscuro** + modo claro forzado para sol directo (pendiente declarado de v1 §8).
- **Compartir**: URL de ruta con fecha seleccionada (query param, como ya hace el informe).
- **Perfil de elevación interactivo**: hover muestra km/elevación y sincroniza un marcador sobre el track en el mapa.
- **i18n preparada**: textos centralizados; español ahora, valencià como primer candidato (sin comprometer fecha).

---

## 14. Milestones v2

Como en v1: cada milestone termina con tests en verde y un commit; no se avanza con tests en rojo.

1. **V2-M1 — Catálogo**: crawler FEMECV completo + estado de homologación + publicación en Pages (CI) + actualización en runtime con almacén local.
2. **V2-M2 — Descubrimiento**: buscador, filtro/badge de estado, botón dado, marcas como filtros.
3. **V2-M3 — Marcas y diario**: marcas de usuario, diario, estadísticas, exportación/importación.
4. **V2-M4 — Meteo avanzada**: pronóstico horario, ventana ideal de inicio, alerta de luz, avisos CAP.
5. **V2-M5 — Viaje**: geolocalización + origen habitual + OSRM + orden por cercanía.
6. **V2-M6 — Mochila e informes**: checklist interactivo + informe con casillas + **ficha de emergencia** (§9) con su bloque de ajustes.
7. **V2-M7 — Datos**: enriquecimiento OSM (agua, sombra), alternativas automáticas, fauna de todas las comarcas (BDB-GVA).
8. **V2-M8 — Offline y pulido**: investigación de tiles → mapa offline si es viable, modo oscuro, perfil interactivo, enlaces Wikiloc, compartir.

---

## 15. Buenas prácticas v2

Las de v1 §10 íntegras, más:

- Todo cliente online nuevo: puro, `fetchFn`/storage/reloj inyectables, caché con TTL, errores tipados (auth/rate-limit/red) y tests con mocks. Los errores nunca se cachean.
- Datos de usuario: esquema versionado con migraciones explícitas y testeadas; nunca perder datos del usuario en una actualización.
- Crawling solo de portales oficiales públicos (FEMECV), con rate-limit, caché y `User-Agent` identificable. Jamás contra Wikiloc.
- Enriquecimientos automáticos siempre distinguibles de datos verificados (cita + etiqueta); la UI no los presenta con la misma autoridad.
- Geolocalización: solo bajo gesto del usuario, nunca persistida, nunca enviada a terceros (OSRM recibe coordenadas de origen únicamente al calcular una ruta y así se declara en ajustes).
