# SPECS V3 — Senderos CV

Especificación de la **versión 3** de Senderos CV. Define los **deltas** sobre
[SPEC.md](SPEC.md) (v1) y [SPECS_V2.md](SPECS_V2.md) (v2): todo lo no modificado
aquí sigue rigiéndose por v1 y v2, incluidas sus restricciones y buenas
prácticas. v1 (M1–M7) y v2 (V2-M1…V2-M8) están implementadas; este documento no
invalida ninguna decisión cerrada anterior salvo donde se indica explícitamente.

**Principio rector de la v3:** se mantiene intacta la arquitectura cerrada **sin
backend**. Las funcionalidades que exigen servidor (cuentas de usuario, login con
OTP, recuperación de contraseña, recopilación central de analítica) se **aplazan
a la v4** (§11). La v3 deja el terreno preparado para ellas sin introducir
backend.

---

## 1. Decisiones de arquitectura v3 (cerradas)

| Capa                | v2                                                  | v3                                                                                                                          |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mapa base           | **Base IGN única** (WMTS MTN, online = offline)     | + **Selector de capas IGN** (topográfico por defecto, ortofoto/satélite PNOA, base) sin perder la equivalencia offline      |
| Capas de datos      | water_points como texto en ficha                    | **Capas sobre el mapa**: fuentes de agua y **puntos de interés (POIs)** como marcadores, con toggles (visibles por defecto) |
| Motor de mochila    | Decisiones puras `enable/disable/indeterminate`     | + **Material custom del usuario con atributos** → el motor lo evalúa y **desaconseja** lo inadecuado (nuevo estado `warn`)  |
| Rutas multi-etapa   | Etapas como GPX sueltos, sin relación modelada      | **Modelo padre→etapas** + UI de etapas + el "Ver Etapas" deja de ser texto muerto                                           |
| Datos de usuario    | Marcas, diario, checklist (localStorage versionado) | + **material custom** y **preferencias de apariencia** (tema/paleta/capa); diseñados **anonimizables y exportables** (v4)   |
| Apariencia          | Modo claro/oscuro/auto en Ajustes                   | + **toggle rápido en la barra** + **paletas de color** curadas, elegibles en **Ajustes**                                    |
| Cuentas / analítica | —                                                   | **Aplazado a v4** (requiere backend, §11)                                                                                   |

**Restricciones que se mantienen (innegociables, de v1 §1 y v2 §1):**

- **Sin backend, sin base de datos en runtime.** GitLab Pages es hosting
  estático: la app solo hace GET de ficheros. (La v4 reabrirá esta decisión; la
  v3 no.)
- **Wikiloc NUNCA como fuente de datos** (solo enlaces salientes, v2 §10).
- **Prohibido inventar metadatos**: dato no verificado → `null` + entrada en
  `sources`. Aplica a etapas, POIs, imágenes de POI y popularidad: si el portal
  no los publica, no se fabrican.
- Lógica de negocio **pura y sin imports de Svelte**; zod en todos los límites de
  datos externos.
- La app funciona **100% offline** salvo los módulos online ya declarados, que
  degradan con elegancia (estado vacío, nunca rotura ni datos inventados).

---

## 2. Estructura del repo (módulos nuevos o tocados)

```
src/lib/
├── map/
│   ├── layers.ts          # catálogo de capas IGN (id, WMTS, atribución, default)
│   └── tiles.ts           # (v2) URL de tiles; se generaliza a varias capas
├── engine/
│   └── gear.ts            # (v1) + evaluación de material custom y estado `warn`
├── user/
│   ├── customGear.ts      # ítems de mochila definidos por el usuario (atributos)
│   └── appearance.ts      # preferencias de tema/paleta/capa (esquema versionado)
├── data/
│   └── stages.ts          # resuelve la relación ruta padre ↔ etapas
└── theme/
    └── palettes.ts        # paletas de color curadas (tokens claro/oscuro)

src/lib/components/
├── MapLayerSwitcher.svelte   # selector de capa base
├── MapDataToggles.svelte     # toggles de agua / POIs bajo el mapa
├── PoiMarker / PoiPopup      # marcador + ventana flotante (descripción + imagen)
├── StagesList.svelte         # lista de etapas en la ficha del padre
├── ThemeToggle.svelte        # conmutador claro/oscuro en la barra superior
└── ElevationProfile.svelte   # (v2) + relleno bicolor + tooltip legible

scripts/ingest/crawl.ts       # + etapas, + waypoints/POIs, + popularidad (si existe)
```

---

## 3. Modelo de datos (cambios sobre v2 §3)

```jsonc
// data/routes/<id>.json — solo campos nuevos o modificados en v3
{
	// Provincia, para el filtro de §7. Enum cerrado de las tres provincias de la
	// CV. Derivada de municipio/comarca en la ingesta, siempre con fuente; null si
	// no se puede determinar con certeza (nunca se adivina).
	"province": "valencia", // "alicante" | "castellon" | "valencia" | null

	// Relación de etapas (§6). Solo en rutas que el portal marca "Ver Etapas".
	// Cada etapa es a su vez una ruta navegable (su propio <id>.json) enlazada por
	// `parent_id`. El padre lista las etapas en orden.
	"stages": [
		{ "id": "gr-236-e01", "order": 1, "name": "Etapa 1: Gandía–Almiserà" }
		// …
	],
	"parent_id": null, // en una etapa, el id de su ruta padre; null si no es etapa

	// Puntos de interés del track (§5). Solo si vienen en el GPX (waypoints) o en
	// la ficha FEMECV. `image_url` solo si la fuente la publica (no se inventa).
	"pois": [
		{
			"name": "Fuente del Berro",
			"lat": 39.66,
			"lon": -0.88,
			"type": "fuente", // fuente | mirador | patrimonio | refugio | otro
			"description": "Manantial junto al sendero.",
			"image_url": null
		}
	],

	// Popularidad (§7) — SOLO si el portal FEMECV la expone (investigación §13).
	// Si no existe, se queda null y la ordenación por popularidad no se ofrece.
	"popularity": null,

	// Procedencia por campo (v2): añade los nuevos orígenes.
	"field_sources": {
		"province": "derivada de municipio (ficha FEMECV)",
		"pois": "waypoints del GPX FEMECV",
		"popularity": "—"
	}
}
```

- **Fuentes de agua con coordenadas**: el enriquecimiento OSM de v2 §12 ya
  aporta nodos con `lat/lon`; se aprovechan para pintarlas en el mapa (§5). Los
  `water_points` que solo sean texto sin coordenadas **no se pintan**: se siguen
  listando como hasta ahora (honestidad v1).
- **Material custom** (§4) vive en datos de usuario (localStorage), **no** en el
  modelo de ruta.
- Regla de calidad v1/v2 intacta para todo lo nuevo.

---

## 4. Material custom de mochila (motor extendido)

Cubre _añadir objetos custom a la mochila que el motor tenga en cuenta_. El
ejemplo guía: unos **calcetines impermeables** en una ruta **calurosa y sin
agua** no deben recomendarse — el motor debe **avisar** ("pie cocido"), no
sugerirlos en silencio.

- El motor de reglas (v1 §5) **sigue siendo puro y sin imports de Svelte**. Se
  amplía, no se reescribe.
- **Ítem custom** (en `src/lib/user/customGear.ts`):

  ```jsonc
  {
  	"id": "calcetines-impermeables",
  	"name": "Calcetines impermeables",
  	"category": "ropa",
  	"weight_g": 90, // opcional
  	"attributes": ["impermeable", "abrigo"], // vocabulario controlado
  	"custom": true
  }
  ```

  `attributes` es un **vocabulario cerrado** (p. ej. `impermeable`, `abrigo`,
  `ventilado`, `calzado`, `sol`, `agua`…) para que las reglas puedan razonar
  sobre él sin texto libre.

- **Nuevo estado de decisión `warn`** (desaconsejado con motivo), además de
  `enabled | disabled | indeterminate` de v1. Las **anti-reglas** evalúan
  atributos contra condiciones de ruta+meteo:

  ```jsonc
  {
  	"when_attribute": "abrigo",
  	"when": { "temperature_2m_max": { "gte": 28 }, "route.water_points.length": { "eq": 0 } },
  	"action": "warn",
  	"reason": "Prenda de abrigo con {temperature_2m_max} °C y sin agua en ruta: riesgo de exceso de calor"
  }
  ```

- Los ítems custom alimentan el **checklist** (v2 §7) y aparecen en el informe.
  Por defecto visibles; un `warn` se muestra atenuado con su razón, nunca se
  oculta (el usuario decide).
- Persistencia en datos de usuario, **esquema versionado** con migraciones
  (como v2 §8), **exportable** y con forma **anonimizable** pensada para la
  agregación de la v4 (§10).
- Cobertura de tests obligatoria: casos `warn`, atributos múltiples, empates con
  reglas estándar (la fail-safe de v1 se respeta: ante la duda, no se desaconseja
  un ítem `base`).

---

## 5. Mapa v3

### Selector de capas (idea: _cambiar de capa del mapa_)

- La base IGN de v2 §11 deja de ser única: `src/lib/map/layers.ts` define un
  **catálogo de capas IGN** (todas CC-BY, CORS abierto, GoogleMapsCompatible):
  - **MTN topográfico** (la actual) — **por defecto**, mejor lectura del track.
  - **PNOA ortofoto** (satélite/aéreo).
  - **IGN Base** (callejero claro).
  - (Opcional, si rinde) relieve sombreado.
- Selector accesible desde el mapa (`MapLayerSwitcher.svelte`); la elección se
  **persiste** en preferencias locales (§9).
- **Offline**: la descarga de tiles por ruta (v2 §11) sigue ligada a la capa por
  defecto (MTN); si el usuario cambia de capa sin tiles descargados de esa capa,
  se indica que esa capa requiere red. No se rompe la equivalencia online/offline
  de la capa por defecto.

### Visibilidad del track

El problema reportado (a gran altura el track no se distingue; al hacer zoom sí)
se ataca en el **render**, no solo cambiando de capa:

- Línea con **casing** (halo de contraste) + grosor adecuado + color de alto
  contraste, legible **a cualquier zoom** sobre cualquier capa base.
- Sin depender de la capa elegida: el track debe verse igual de bien sobre
  ortofoto que sobre topográfico.

### Pins de inicio y final (idea: _pins de inicio y final_)

- Marcador de **inicio** y de **fin** derivados de los extremos del track. En
  rutas lineales son distintos; en circulares coinciden (un único pin etiquetado
  "inicio/fin").

### Capas de datos con toggles (ideas: _fuentes de agua_ y _puntos de interés_)

- **Fuentes de agua**: un icono por cada `water_point` con coordenadas (§3);
  **toggle bajo el mapa, activado por defecto**.
- **Puntos de interés (POIs)**: marcador por POI; al **hover** sobre el icono,
  **ventana flotante** sobre el mapa con nombre, descripción e **imagen si
  existe** (§3); **toggle bajo el mapa, activado por defecto**.
- Toggles agrupados en `MapDataToggles.svelte` bajo el mapa (agua, POIs, y
  selector de capa accesible cerca).
- Honestidad: si un POI no trae imagen, el popup la omite; si una fuente solo
  tiene texto sin coordenadas, no se pinta (se sigue listando en datos técnicos).

---

## 6. Rutas multi-etapa (ideas: _etapas_ y _"Ver Etapas"_)

Estado actual detectado: el crawl ya marca `status_detail: "Ver Etapas"` en los
GR largos (gr-7, gr-36, gr-37, gr-160, gr-239, gr-331…) y existen los GPX de
etapa con convención `<padre>-e<NN>` (p. ej. `gr-236-e01`), pero la relación no
está modelada ni mostrada, y "Ver Etapas" es **texto plano que no hace nada**.

### Ingesta

- El crawler detecta las rutas con etapas y las **enlaza con sus etapas** por la
  convención de id (`<padre>-e<NN>`) y/o el listado de la ficha. Rellena
  `stages` en el padre y `parent_id`/`order` en cada etapa (§3).
- Cada etapa se ingesta como **ruta completa** (su track, distancia, desnivel,
  etc.), navegable por sí misma.
- Si una etapa esperada falta, se anota como pendiente en `sources` (no se
  inventan totales).

### UI

- En la ficha de una ruta **con etapas**: sección **"Etapas"**
  (`StagesList.svelte`) con la lista ordenada (nombre, distancia, desnivel,
  enlace a cada etapa). El mapa del padre puede mostrar todas las etapas juntas;
  los totales del padre se presentan como **suma de las etapas verificadas**,
  etiquetando si falta alguna.
- El **"Ver Etapas"** (hoy texto muerto en datos técnicos → estado) pasa a
  **enlazar/desplazar** a esa sección.
- Cada etapa, abierta como ruta, ofrece todo lo de una ruta normal (meteo,
  mochila, informe) y un enlace de vuelta al padre.

---

## 7. Descubrimiento v3 (sobre v2 §6)

- **Filtro por provincia** (idea: _filtro por provincia_): nuevo filtro usando
  `province` (§3), junto a los de tipo/distancia/desnivel/zona/estado.
- **Orden por popularidad** (idea: _lista por popularidad_): **condicionado** a
  que FEMECV publique el dato (investigación §13). Si `popularity` existe, se
  ofrece la ordenación "más populares"; si no, **no aparece** (criterio de salida
  documentado, como el mapa offline de v2).
- **Fix de "Cómo llegar"** (idea: _indicaciones OSM solo llevan el inicio_):
  hoy `ruta/[id]/+page.svelte` construye el enlace saliente como
  `openstreetmap.org/directions?to=<inicio>` **sin origen**, así que en OSM hay
  que rellenar a mano el punto de partida. v3 añade
  `from=<origen>` (geolocalización o el "origen habitual" de v2 §6) cuando se
  conoce, para que las indicaciones lleven **ambos extremos**. Sin origen, se
  mantiene el comportamiento actual (solo `to`). La posición no se persiste ni se
  envía a terceros más allá del propio enlace que abre el usuario.

---

## 8. Perfil de elevación v3 (idea: _mejorar el widget de elevación_)

Mejoras sobre el `ElevationProfile.svelte` interactivo de v2 §13:

- **Relleno bicolor**: distinto color por encima y por debajo del dato de
  elevación (relleno bajo la curva vs. zona superior), para leer de un vistazo
  el perfil. Coherente con el tema activo.
- **Tooltip flotante legible**: los datos que aparecen al seguir la ruta con el
  ratón se reescriben con **contraste fijo** (fondo sólido + texto contrastado),
  independiente del fondo del widget y del tema claro/oscuro. Hoy se pierden por
  la elección de colores; v3 lo corrige.

---

## 9. Apariencia: toggle y paletas (ideas: _toggle claro/oscuro en la barra_ y _temas de color_)

Estado actual: `src/lib/settings.ts` ya define `theme: 'auto' | 'claro' |
'oscuro'`, aplicado en el layout y elegible en Ajustes. v3 construye **sobre eso**
y **sin backend** (la selección por usuario que pedías se resuelve en Ajustes,
no en un backoffice):

- **Toggle en la barra superior** (`ThemeToggle.svelte`): atajo del setting
  existente; conmuta claro↔oscuro (respetando "auto") y persiste en localStorage.
- **Paletas de color curadas** (`src/lib/theme/palettes.ts`): un conjunto de
  paletas hechas a mano, cada una con sus **tokens de color para claro y oscuro**
  (la actual "Bosque" + alternativas, p. ej. "Alto contraste sol", "Piedra",
  "Mar"). Elegibles en **Ajustes**. Persistencia local con esquema versionado
  (§10). El motor de temas aplica `[data-theme]` × `[data-palette]` por tokens
  CSS, sin romper el "claro forzado" para sol directo.

---

## 10. Datos de usuario y preparación de la analítica v4

- Todo lo nuevo de usuario (material custom, preferencias de apariencia) se suma
  a marcas/diario/checklist de v2 en **localStorage con esquema versionado y
  migraciones explícitas y testeadas**. Nunca se pierden datos en una
  actualización (v2 §15).
- **Preparación para la v4 (sin recopilar nada todavía):** los datos agregables
  —favoritos, rutas completadas, material custom— se guardan en forma
  **estructurada, anónima por diseño y exportable**, de modo que la v4 pueda
  ofrecer rankings (rutas más recorridas/favoritas, material más repetido)
  **agregando sin vincular a personas**. La v3 **no recopila ni envía nada**.
- Cuando llegue la v4: recopilación **opt-in explícita**, anonimización real y
  base legal RGPD documentada (es dato de personas en España). Esto se decide en
  la v4; aquí solo se garantiza que el formato local no lo impida.

---

## 11. Aplazado a la v4 (requiere backend)

Decisión tomada con el usuario (2026-06-19): estas funcionalidades **rompen la
regla "sin backend"** y se posponen a la v4, pendientes de elegir proveedor
(recomendado: **Supabase** — Auth con OTP y emails de recuperación, Postgres con
RLS; el frontend seguiría estático en Pages y offline, solo login/analítica
online y con degradación elegante):

- **Sistema de cuentas**: registro, login, "mantener sesión".
- **Login reforzado opcional**: OTP por app externa (TOTP) o por email.
- **Recuperación de contraseña** por email.
- **Backoffice de usuario**: cambiar contraseña, datos personales y de mochila
  sincronizados entre dispositivos.
- **Recopilación central de analítica anónima**: rankings de rutas y material
  (el formato local de §10 ya queda preparado para alimentarla).

Hasta entonces, la v3 entrega todo lo demás sobre la arquitectura actual, sin
introducir servidor.

---

## 12. Milestones v3

Como en v1/v2: cada milestone termina con **tests en verde y un commit**; no se
avanza con tests en rojo. Documentación on the fly (comentarios/markdown) en cada
función nueva, no como paso aparte.

1. **V3-M1 — Mapa base**: selector de capas IGN (`layers.ts` +
   `MapLayerSwitcher`), visibilidad del track (casing/contraste), pins de inicio
   y fin.
2. **V3-M2 — Capas de datos**: fuentes de agua con icono + toggle; POIs con
   marcador, popup (descripción + imagen) y toggle; crawl de waypoints/POIs.
3. **V3-M3 — Etapas**: crawl de la relación padre↔etapas + modelo (`stages.ts`) +
   `StagesList` + "Ver Etapas" funcional.
4. **V3-M4 — Descubrimiento**: filtro por provincia, orden por popularidad (si la
   investigación lo permite), fix del enlace "Cómo llegar" (origen + destino).
5. **V3-M5 — Perfil de elevación**: relleno bicolor + tooltip legible.
6. **V3-M6 — Mochila custom**: material custom con atributos + estado `warn` en
   el motor (anti-recomendaciones) + integración en checklist e informe +
   formato exportable/anonimizable (§10).
7. **V3-M7 — Apariencia**: toggle claro/oscuro en la barra + paletas de color en
   Ajustes (`palettes.ts`), con persistencia versionada.

(El orden es orientativo; M1/M2 son independientes de M3–M7 y pueden solaparse.)

---

## 13. Investigación previa (criterios de salida)

Como el mapa offline de v2 §11, hay datos cuya viabilidad depende de lo que el
portal publique. Cada uno se resuelve **antes** de comprometer la UI, con criterio
de salida explícito para no inventar datos:

| Dato                 | Pregunta                                                              | Si NO existe                                                                |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Popularidad**      | ¿FEMECV expone visitas / nº de descargas / popularidad por ruta?      | No se ofrece la ordenación por popularidad (idea descartada y documentada). |
| **Imágenes de POI**  | ¿Los waypoints o la ficha traen imágenes y URL accesible/citable?     | POIs sin imagen (solo nombre + descripción); nunca se inventa una imagen.   |
| **POIs / waypoints** | ¿Los GPX FEMECV traen waypoints con nombre/descripción aprovechables? | Sin POIs en esas rutas; no se fabrican.                                     |
| **Etapas**           | ¿La relación padre↔etapas es derivable por id (`-eNN`) y/o ficha?     | Se modela solo donde sea seguro; el resto queda como rutas independientes.  |

---

## 14. Buenas prácticas v3

Las de v1 §10 y v2 §15 íntegras, más:

- **Capas de datos en mapa**: nunca pintar lo que no tiene coordenadas
  verificadas; imágenes de POI solo si la fuente las publica y se citan.
- **Motor de mochila**: sigue puro y testeado, incluido el material custom y el
  estado `warn` (casos de anti-recomendación cubiertos por tests).
- **Datos de usuario nuevos**: esquema versionado, migración testeada,
  export/import; diseñados **anonimizables** para la futura agregación v4, sin
  recopilar nada en v3.
- **Crawl de etapas/POIs/popularidad**: misma cortesía que v2 (rate-limit, caché,
  `User-Agent` identificable) y criterio de salida si el dato no existe.
- **Apariencia**: las paletas no rompen el "claro forzado" para sol directo ni el
  contraste mínimo; el tooltip de elevación mantiene contraste fijo en cualquier
  tema.
- **Sin backend en v3**: cualquier necesidad de servidor se anota en §11 (v4), no
  se introduce a hurtadillas.
