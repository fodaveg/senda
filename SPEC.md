# SPEC — Senderos CV

Web app autocontenida (Linux, macOS, web) con las rutas oficiales de senderismo de la Comunitat Valenciana, recomendación de equipo de mochila condicionada por ruta y meteorología, y generación de informes Markdown (Obsidian) e imprimibles.

Este documento es la especificación de referencia para implementar el proyecto con Claude Code. Copiarlo como `SPEC.md` en la raíz del repo y crear un `CLAUDE.md` que lo referencie.

---

## 1. Decisiones de arquitectura (cerradas)

| Capa                | Tecnología                                                                                | Notas                                                        |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Shell nativo        | Tauri 2                                                                                   | Binarios Linux (Fedora) y macOS. Sin Electron.               |
| Frontend            | SvelteKit + TypeScript (modo `adapter-static`)                                            | Misma base de código para Tauri y despliegue web/PWA.        |
| Mapas               | MapLibre GL JS                                                                            | Tiles raster IGN / OpenTopoMap. Render de GPX como GeoJSON.  |
| Datos de rutas      | Estáticos en build: `data/routes/*.json` + `data/gpx/*.gpx`                               | Sin backend, sin base de datos.                              |
| Pipeline de ingesta | Script Node TypeScript (`scripts/ingest/`)                                                | Se ejecuta manualmente, no en runtime.                       |
| Meteo               | Open-Meteo (primaria, sin API key) · AEMET OpenData (verificación, key gratuita opcional) | Único módulo que requiere red. Degradación elegante offline. |
| Reglas de mochila   | JSON declarativo + motor de evaluación puro                                               | Ver §5. Testeable con Vitest.                                |
| Informes            | Plantilla Markdown + CSS `@media print`                                                   | Un generador, dos salidas.                                   |
| Tests               | Vitest (unitarios) + Playwright (e2e básico)                                              | Cobertura obligatoria en motor de reglas e ingesta.          |
| Lint/format         | ESLint + Prettier, `svelte-check` en CI                                                   |                                                              |
| CI                  | GitHub Actions: lint, test, build web, build Tauri (matrix linux/macos)                   |                                                              |

**Restricciones explícitas:**

- Sin Electron, sin backend, sin base de datos en runtime.
- Wikiloc NO se integra como fuente de datos (sin API pública; términos de uso). Solo enlace manual opcional por ruta en el campo `links.wikiloc`.
- La app debe funcionar 100% offline excepto el módulo meteo, que muestra estado "sin conexión / sin pronóstico" sin romper nada.

---

## 2. Estructura del repositorio

```
senderos-cv/
├── CLAUDE.md                  # instrucciones para Claude Code (referencia a SPEC.md)
├── SPEC.md                    # este documento
├── src/                       # SvelteKit
│   ├── lib/
│   │   ├── components/        # Map.svelte, BackpackPanel.svelte, WeatherCard.svelte, ...
│   │   ├── engine/            # motor de reglas (puro, sin dependencias de UI)
│   │   ├── weather/           # clientes Open-Meteo y AEMET + normalizador
│   │   ├── report/            # generador Markdown + plantillas
│   │   └── types.ts           # tipos compartidos (Route, GearRule, WeatherDay, Report)
│   └── routes/                # páginas SvelteKit
├── src-tauri/                 # shell Tauri 2
├── data/
│   ├── routes/                # JSON por ruta (salida de la ingesta)
│   ├── gpx/                   # GPX originales FEMECV
│   ├── gear/
│   │   ├── items.json         # catálogo de ítems de mochila
│   │   └── rules.json         # reglas condicionales
│   └── wildlife/zones.json    # fauna por zona (ver §7)
├── scripts/
│   └── ingest/                # descarga/parseo GPX FEMECV → routes/*.json
├── static/                    # tiles offline opcionales, iconos, manifest PWA
└── tests/
```

---

## 3. Modelo de datos de ruta

Fuente autoritativa: senderos homologados FEMECV (PR-CV, GR, SL-CV). La ingesta parte de los GPX descargados del portal FEMECV y de metadatos completados manualmente o semiautomáticamente.

```jsonc
// data/routes/pr-cv-77.json
{
	"id": "pr-cv-77",
	"name": "PR-CV 77 Chulilla – Charco Azul",
	"type": "PR", // GR | PR | SL
	"status": "homologado",
	"zone": "serranos", // clave de data/wildlife/zones.json
	"start": { "lat": 39.654, "lon": -0.889, "name": "Chulilla, plaza" },
	"distance_km": 11.2,
	"ascent_m": 420,
	"descent_m": 420,
	"circular": true,
	"difficulty_mide": { "medio": 2, "itinerario": 2, "desplazamiento": 2, "esfuerzo": 3 },
	"est_duration_min": 210,
	"water_points": ["Fuente del Berro (km 4,1)"],
	"escape_routes": ["Pista a Chulilla en km 6,5"],
	"highlights": ["Puentes colgantes", "Charco Azul", "Cañón del Turia"],
	"best_season": ["oct", "nov", "mar", "abr", "may"],
	"best_start_time": "primera hora; en verano antes de las 08:00",
	"shade_ratio": 0.3, // 0–1, proporción de sombra estimada
	"gpx": "pr-cv-77.gpx",
	"links": {
		"femecv": "https://...",
		"wikiloc": null // opcional, manual
	},
	"alternatives": ["sl-cv-xx"], // ids de rutas alternativas cercanas
	"notes_rain": "Evitar tras lluvias fuertes: el cañón del Turia es zona inundable.",
	"sources": ["FEMECV GPX 2026-03", "trabajo de campo"]
}
```

Regla de calidad: ningún campo inventado. Si un dato no está verificado, `null` + entrada en `sources` indicando pendiente. (Verificación antes que completitud.)

### Pipeline de ingesta (`scripts/ingest/`)

1. Entrada: GPX de FEMECV en `data/gpx/`.
2. Parseo con `@tmcw/togeojson`: distancia, desnivel acumulado (+/−), bounding box, punto de inicio.
3. Merge con `data/routes/_manual/<id>.json` (metadatos no derivables del GPX: MIDE, fuentes de agua, highlights…).
4. Salida validada contra schema (zod) en `data/routes/<id>.json`.
5. El script falla con error claro si hay campos obligatorios ausentes o GPX corrupto.

---

## 4. Módulo meteo

- **Open-Meteo** (primaria): forecast diario por coordenadas del punto de inicio. Variables: `temperature_2m_max/min`, `precipitation_probability_max`, `precipitation_sum`, `uv_index_max`, `wind_speed_10m_max`, `sunrise/sunset`. Sin API key, CORS abierto.
- **AEMET OpenData** (opcional, si hay key en ajustes): pronóstico municipal como segunda fuente. Si ambas difieren significativamente (p. ej. prob. lluvia ±30 pts), mostrar ambas y marcar la discrepancia. Nunca promediar en silencio.
- Selector de fecha: hoy + 7 días. Más allá, la UI lo bloquea con aviso "pronóstico no fiable a ese plazo".
- Normalizador común → tipo `WeatherDay` que consume el motor de reglas.
- Sin red: la app funciona; panel meteo en estado vacío y las reglas dependientes de meteo quedan en "indeterminado" (ítem visible, atenuado, con icono de duda — nunca un falso "no lo lleves").

---

## 5. Motor de reglas de mochila

Núcleo del proyecto. Función pura: `(Route, WeatherDay, Season) → GearDecision[]`. Cero dependencias de UI. Cobertura de tests obligatoria.

### Catálogo (`data/gear/items.json`)

```jsonc
{
	"id": "poncho",
	"name": "Poncho / chubasquero",
	"category": "ropa",
	"weight_g": 230,
	"base": false
}
// base: true = siempre en mochila (botiquín, agua, móvil, frontal, manta térmica, silbato)
```

### Reglas (`data/gear/rules.json`)

```jsonc
[
	{
		"item": "poncho",
		"when": { "precipitation_probability_max": { "gte": 20 } },
		"action": "enable",
		"reason": "Probabilidad de lluvia {precipitation_probability_max}%"
	},
	{
		"item": "poncho",
		"when": { "precipitation_probability_max": { "lt": 5 }, "precipitation_sum": { "eq": 0 } },
		"action": "disable",
		"reason": "0% de lluvia previsto"
	},
	{
		"item": "gorro_ala",
		"when": { "uv_index_max": { "gte": 7 }, "route.shade_ratio": { "lt": 0.4 } },
		"action": "enable",
		"reason": "UV {uv_index_max} y poca sombra: gorro de ala mejor que gorra",
		"replaces": "gorra"
	},
	{
		"item": "crema_solar",
		"when": { "uv_index_max": { "gte": 6 } },
		"action": "enable",
		"priority": "alta",
		"reason": "UV {uv_index_max}: reaplicar cada 2 h"
	},
	{
		"item": "agua_extra_1l",
		"when": { "temperature_2m_max": { "gte": 28 }, "route.water_points.length": { "eq": 0 } },
		"action": "enable",
		"reason": "Calor y sin fuentes en ruta"
	}
]
```

### Semántica de evaluación

- Operadores: `gte`, `gt`, `lte`, `lt`, `eq`, `in`. Condiciones dentro de un `when` = AND. Varias reglas sobre el mismo ítem: la más específica (más condiciones) gana; empate → `enable` gana a `disable` (fail-safe: ante la duda, llévalo).
- `replaces`: deshabilita el ítem sustituido y enlaza ambos en la UI ("gorro en lugar de gorra").
- Resultado por ítem: `enabled | disabled | indeterminate`, con `reason` interpolada siempre visible.
- Los ítems `base: true` no pueden ser deshabilitados por reglas.

---

## 6. Generador de informes

Entrada: `Route + WeatherDay + GearDecision[] + WildlifeZone`. Salida Markdown:

```markdown
---
tipo: informe-ruta
ruta: PR-CV 77 Chulilla – Charco Azul
fecha: 2026-06-14
distancia_km: 11.2
desnivel_m: 420
fuente: FEMECV
---

# PR-CV 77 — Chulilla – Charco Azul

## Datos técnicos

## Meteorología prevista (fuente y hora de consulta)

## Mejor momento para empezar

## Mochila recomendada (con razones)

## Puntos destacados

## Fuentes de agua y escapes

## Rutas alternativas

## Si llueve / plan B

## Fauna y seguridad en la zona

## Fuentes
```

- Exportación: descarga `.md` (frontmatter compatible con Obsidian) y vista imprimible con CSS `@media print` (la misma vista del informe).
- En Tauri: opción "guardar en carpeta" con ruta configurable en ajustes (p. ej. carpeta del vault de Obsidian).
- Toda afirmación del informe lleva fuente: FEMECV, GPX, Open-Meteo/AEMET con timestamp, o ficha de zona. Nada generado sin origen.

---

## 7. Fauna y seguridad (`data/wildlife/zones.json`)

**Sin osos: no hay oso pardo en la Comunitat Valenciana** (su área en España es Cordillera Cantábrica y Pirineos). La sección de fauna es por zona y con datos reales:

```jsonc
{
	"serranos": {
		"name": "Los Serranos / Alto Turia",
		"wildlife": [
			{
				"species": "jabalí",
				"risk": "bajo",
				"advice": "No acercarse a crías; ruido moderado al caminar al amanecer/atardecer."
			},
			{
				"species": "víbora hocicuda",
				"risk": "bajo",
				"advice": "Mirar dónde se ponen manos y pies en roquedos; en caso de mordedura, inmovilizar y 112."
			},
			{
				"species": "perro de ganado (mastín)",
				"risk": "medio",
				"advice": "No correr, no mirar fijamente, rodear el rebaño con distancia."
			}
		],
		"other_risks": ["golpe de calor en verano", "crecidas súbitas en el cañón del Turia"]
	}
}
```

El esquema admite especies como el oso para que el modelo de datos sea reutilizable fuera de la CV (Pirineos), pero ninguna zona de la CV lo incluirá.

---

## 8. UI (tres vistas)

1. **Listado/mapa**: mapa MapLibre con todas las rutas + filtros (tipo, distancia, desnivel, zona, circular).
2. **Detalle de ruta**: track sobre mapa, perfil de elevación, datos técnicos, selector de fecha → panel meteo → panel mochila (ítems habilitados/deshabilitados/sustituidos con razones). Botón "Generar informe".
3. **Informe**: vista renderizada + botones "Descargar .md" / "Imprimir" / (Tauri) "Guardar en vault".

Idioma de la UI: español. Diseño sobrio, alto contraste, usable con sol directo en móvil (modo claro forzado opcional).

---

## 9. Fases de implementación (milestones para Claude Code)

1. **M1 — Esqueleto**: SvelteKit + Tauri 2 + CI verde (lint, test, builds linux/macos/web).
2. **M2 — Motor de reglas**: tipos, evaluador puro, `items.json` y `rules.json` iniciales, suite de tests (incluye casos `replaces`, conflictos y `indeterminate`).
3. **M3 — Ingesta**: script GPX→JSON con validación zod; cargar 5 rutas reales FEMECV de prueba.
4. **M4 — Mapa + detalle**: MapLibre, track, perfil de elevación, panel de datos.
5. **M5 — Meteo**: cliente Open-Meteo, normalizador, integración con el motor de reglas, estados offline.
6. **M6 — Informe**: generador Markdown, frontmatter, vista print, guardado en Tauri.
7. **M7 — Pulido**: AEMET opcional, fauna por zonas, PWA offline, empaquetado final.

Cada milestone termina con tests pasando y un commit. No avanzar de milestone con tests en rojo.

---

## 10. Buenas prácticas exigidas

- TypeScript estricto (`strict: true`), validación de datos externos con zod en los límites (ingesta, respuestas meteo).
- Lógica de negocio (motor de reglas, normalizador meteo, generador de informe) pura y sin imports de Svelte.
- Sin dependencias innecesarias; justificar cada paquete nuevo en el PR.
- Conventional commits. README con instrucciones de build para Fedora y macOS.
- Datos manuales siempre con campo `sources`; prohibido inventar metadatos de ruta.
