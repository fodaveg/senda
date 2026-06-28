# SPECS V5 — Investigación de fuentes: federaciones de montaña de España

> **Para V5-1 (multi-federación).** Mapa de fuentes de datos de senderos
> homologados (GR/PR/SL) de las federaciones española y autonómicas, con vistas
> al **pipeline de ingesta**. Solo **España**. _Investigado: 2026-06-28_ (mezcla
> de conocimiento + verificación web; las URLs marcadas «verificar» no se han
> confirmado a nivel de fichero descargable).

> **Endpoints concretos por comunidad** (a qué atacar en ingest/actualizaciones):
> ver **[SPECS_V5_CCAA_ENDPOINTS.md](SPECS_V5_CCAA_ENDPOINTS.md)** (dosier de las
> 17 CCAA + cobertura nacional medida). Sondeo reproducible:
> `node scripts/ingest/poc/federaciones-cobertura.mjs`.

## Conclusión / recomendación estratégica

**Hay una fuente nacional, oficial, descargable y con licencia compatible que
agrega TODAS las federaciones: el Centro de Descargas del CNIG (IGN), serie
«Senderos FEDME».** ~50.000 km de GR/PR/SL en **GPX, KML y SHP**, filtrable por
comunidad autónoma / provincia / municipio. Licencia **IGN (CC-BY)** — la misma
familia que ya usamos para los tiles.

> ⚠️ **Revisión (2026-06-28): el nacional NO es la fuente principal.** La medición
> de cobertura (Fase A) demostró que MiSendaFEDME/CNIG está **sesgado por subida**:
> La Rioja 0, Madrid 13, Canarias 24, Galicia 35… e incluso CV 274 vs ~585 por
> FEMECV. Usar el nacional como autoridad de existencia daría un catálogo
> **incompleto y sesgado**. Por eso la prioridad se invierte (ver "Modelo de
> ingesta ACORDADO").

**Arquitectura (prioridad invertida):**

1. **Fuente principal por CCAA = la fuente oficial regional** (la **IDE/open-data
   de la comunidad**, a veces co-publicada con la federación; o el portal de la
   federación si expone datos accesibles). Es la **autoridad de existencia y la
   más completa**. La "federación" en sentido literal (web fedXXX.es) suele ser
   mala fuente técnica → lo bueno es la IDE regional (WFS/open-data estándar).
2. **Estado de homologación** = lista oficial de la federación/administración.
3. **CNIG/MiSendaFEDME = SOLO respaldo**: cross-check, **geometría con licencia
   clara (CNIG CC-BY)** cuando el WFS regional no tenga licencia evidente, y
   cobertura mínima donde la fuente regional no sea accesible.
4. **FEMECV** sigue siendo la fuente de **CV** (ya integrada).
5. **Wikiloc: excepción acotada (revisión 2026-06-28)**. Se levanta la prohibición
   **solo** cuando el publicador es la **cuenta oficial verificada de la
   federación** (allowlist de cuentas), y **solo** como fuente de
   **geometría/existencia + enlace canónico**, **nunca de estado**. Sigue
   prohibido cualquier track de usuario no oficial (la regla original era no
   llenar la app de rutas no verificadas/repetidas/irrelevantes).
   - ⚠️ **ToS de Wikiloc**: que el contenido sea oficial resuelve autoría, pero el
     ToS restringe el **scraping/descarga automatizada**. Camino limpio: usar la
     cuenta oficial como **señal de confianza + enlace**, tomar la **geometría de
     CNIG/IDE** y, donde solo esté en Wikiloc, **pedir los GPX a la federación**.
   - Cuentas oficiales conocidas (a verificar/ampliar en la allowlist): FAM Aragón,
     FMM Madrid, FDMESCYL Castilla y León, FEEC (canal oficial).
   - Desbloquea sobre todo Aragón/Madrid/CyL/Cataluña donde no haya capa regional.

Coste: reintroduce **adaptadores por CCAA** (más trabajo que "una sola API"), pero
evita el sesgo. La ventaja: para casi todas la fuente regional es un **WFS/open-data
estándar** (no scraping frágil) — ver `SPECS_V5_CCAA_ENDPOINTS.md`.

Esto encaja con el pipeline actual `crawl → build → enrich` (`scripts/ingest/`):
el CNIG sustituiría/ampliaría la fase `crawl` (descarga de GPX + índice), y los
portales propios entrarían como fuentes de `enrich` (como `enrich/osm.ts`).

## Modelo de ingesta ACORDADO (decisiones del usuario, 2026-06-28)

Refinamiento del modelo híbrido tras la investigación:

- **Comunitat Valenciana**: se mantiene **FEMECV tal cual** (geometría + metadatos
  ricos + estado). No se toca; es la fuente de CV.
- **Resto de CCAA** (prioridad invertida tras la Fase A):
  1. **Existencia + cobertura + matrícula + geometría → fuente OFICIAL REGIONAL**
     (IDE/open-data de la comunidad, o portal de la federación si es accesible).
     Es la autoridad y la más completa. **CNIG/MiSendaFEDME solo como respaldo**
     (cross-check, geometría licenciada CC-BY, o cobertura donde la región no
     exponga datos accesibles).
  2. **El estado de la ruta (`status`/`status_detail`) viene SIEMPRE de la
     federación/administración** (su lista oficial), nunca del agregador nacional.
  3. **Gate de existencia**: una ruta se publica si está en la **fuente oficial de
     su CCAA**. El nacional no decide existencia (está sesgado por subida); solo
     rellena huecos cuando la región no tiene fuente accesible.
  4. **Por bloque/funcionalidad de la ficha** (la v6 ya es modular):
     - dato **expuesto** por la federación → se muestra;
     - la federación **no expone** ese dato públicamente → **no se muestra el
       bloque**, o se pone una **capa encima**: «_(Federación X) no expone
       públicamente datos para esta funcionalidad_»;
     - dato **desconocido** (la fuente lo expone pero esta ruta no lo trae) →
       regla actual: `null` + entrada en `sources` (no inventar).
  5. Enriquecimiento adicional con **OSM** (agua/POIs) como hoy.

> Para verificar estado/metadatos **no hace falta el GPX de la federación** (ya lo
> da CNIG): basta su **ficha/visor/open-data PÚBLICO** (NO Wikiloc, NO login). Eso
> amplía las federaciones usables (muchas tienen el track gated pero el estado
> visible públicamente).

### Implicaciones técnicas

- **Matriz de capacidades por federación**: qué funcionalidades publica cada una
  (estado, MIDE, agua, descripción, etapas…), para decidir por bloque entre
  _mostrar_ / _overlay «no expone»_ / _sin dato_. Más procedencia por campo.
- **Adaptador por federación**: lee el catálogo PÚBLICO (web/visor/open-data) para
  confirmar **existencia + estado + metadatos expuestos**. No usa Wikiloc ni
  fuentes tras login como dato.
- **Emparejado CNIG ↔ federación** por **matrícula GR/PR-XX + nombre + proximidad
  de extremos**. Es el grueso del trabajo. Mitigación de falsos negativos
  (ocultarían rutas reales): matching tolerante + **informe de no-emparejadas** +
  lista de **overrides** manuales.

### Riesgo / decisión abierta (por federación, al implementar)

Federaciones **sin ningún metadato público por ruta** (solo Wikiloc o todo tras
login): bajo el gate de existencia, su CCAA **no mostraría nada**. Decisión por
federación: **(a)** usar su **visor público** si al menos da el estado
(probable en FAM Aragón / FEEC Cataluña), o **(b)** dejar esa CCAA **fuera** hasta
que publique datos. Preferencia: (a) cuando haya estado público; (b) como último
recurso. Es configuración del adaptador, no condiciona el diseño.

## PoC Navarra (2026-06-28) — resultados ✅

Script reproducible: `scripts/ingest/poc/navarra.mjs` (no toca runtime/catálogo).
Informe: `scripts/ingest/poc/navarra-report.json`. Ejecutar:
`node scripts/ingest/poc/navarra.mjs`.

**Hallazgo principal**: la federación navarra (**FNDME**, `senderos.nafarmendi.org`)
**delega su buscador en MiSendaFEDME**, que expone un **endpoint JSON limpio**:

```
POST https://misendafedme.es/buscador-de-senderos/inc/buscar_etapas_mapa.php
body: ccaa=nc        (Comunidad Foral de Navarra)
→ JSON [{ matricula, codi_matricula(GR/PR/SL), titulo, permalink, id,
          arxiu(=ruta GPX), gr_parent_titulo, gr_parent_permalink }]
```

Resultado para Navarra: **79 etapas** (GR 57 · PR 7 · SL 15), **21 senderos**.
Matrículas: GR 11/12/20/220/225/321/323, GR T 0x (transfronterizos), `PR-NA xxx`
y `SL-NA xx`. El sufijo `-NA` identifica la federación; los GR son
nacionales/transfronterizos.

**Validación del modelo acordado:**

- **Existencia + estado**: MiSendaFEDME solo lista senderos **en vigor**; no hay
  campo de estado explícito ⇒ **presencia ≈ homologado**, y las rutas de baja
  **no aparecen** (el gate "en CNIG pero no en la federación → no se muestra" se
  cumple solo). ✔
- **Geometría**: el GPX (`arxiu`) descarga y parsea bien (p. ej. GR 11 etapa 1 =
  1701 puntos). **La longitud del track coincide con la declarada por la
  federación** (31,5≈31,45 km; 30,1≈30,1; 9,5≈9,5; 4≈4; 2,1≈2,1) → valida el
  emparejado. Excepción: **PR-NA 121** declara 18,8 km pero el track da 25,9 km →
  _hallazgo de calidad de dato_ (marcar/avisar, no inventar). ⚠
- **Matriz de capacidades (FNDME vía MiSendaFEDME)**:
  - **Expone**: existencia, matrícula, tipo, sendero↔etapas, **GPX**, longitud,
    desnivel ±, tiempo, recorrido (lineal/circular), CCAA.
  - **NO expone públicamente** (⇒ ocultar bloque o capa "_(FNDME) no expone
    públicamente datos para esta funcionalidad_"): **estado explícito**, **MIDE/
    dificultad**, **agua/fuentes**, **POIs**, **descripción estructurada**,
    **fauna/riesgos**. Distinto de "dato desconocido" (regla `null` + `sources`). ✔
- **Identidad/emparejado**: la **matrícula base no es única por sendero** (p. ej.
  "GR 11" aparece como 3 _parents_ distintos) ⇒ el join CNIG↔federación debe usar
  **matrícula + nombre + proximidad de geometría**, como ya se previó. ✔

**Conclusión PoC**: el modelo es **viable** para Navarra con una sola fuente
pública (MiSendaFEDME) para existencia/estado/metadatos/GPX. En producción, la
**geometría se tomaría del CNIG (CC-BY)** unida por matrícula+nombre (el GPX de
MiSendaFEDME queda como respaldo, licencia a confirmar). Como MiSendaFEDME es el
buscador **nacional**, este mismo endpoint sirve para **otras CCAA** cambiando
`ccaa=` (verificar cuáles delegan en él).

## Aviso legal / homologación (no inventar)

- La **«homologación» FEDME** (marcas registradas GR®/PR®/SL®) la gestionan las
  federaciones; el estado oficial de cada sendero solo es fiable desde su
  federación/portal oficial. Mantener `status`/`status_detail` + `sources` por
  ruta, como ya se hace con FEMECV.
- Algunas CCAA (p. ej. **Canarias**) tienen **redes de senderos propias
  reguladas por ley autonómica / Cabildos**, no siempre coincidentes con la marca
  GR/PR FEDME. Tratar su `federacion`/`source` y atribución de forma específica.
- **Atribución por fuente** obligatoria (gancho ya previsto en la v6: tarjeta y
  ficha muestran «FEMECV · oficial», etc.). Cada origen con su línea en `sources`.

---

## Fuente nacional unificada — FEDME vía CNIG/IGN ⭐

| Campo               | Valor                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ámbito              | Toda España (agrega las federaciones autonómicas)                                                                                                                                                                                                  |
| Portal              | `https://centrodedescargas.cnig.es/CentroDescargas/senderos-fedme`                                                                                                                                                                                 |
| Búsqueda/filtro     | `…/buscar.do?filtro.codFamilia=FEDME` · descarga KML masiva: `…/senderos-fedme-kml.do`                                                                                                                                                             |
| Visor               | `https://nco.ign.es/visornco/`                                                                                                                                                                                                                     |
| Formatos            | **GPX** y **KML** por **etapa**; **SHP** por tipo (GR/PR/SL)                                                                                                                                                                                       |
| Filtros             | comunidad autónoma · provincia · municipio · tipo · hoja MTN50 · coordenadas                                                                                                                                                                       |
| Atributos (SHP)     | ID, nombre de etapa, longitud, fecha de edición (⇒ metadatos pobres, enriquecer)                                                                                                                                                                   |
| Licencia            | IGN / CC-BY (atribución)                                                                                                                                                                                                                           |
| Acceso programático | La **nueva versión del Centro de Descargas usa API-CNIG**, con «URLs únicas por fichero, producto y agrupación» para integración. Ver `…/servicios-web` y `https://plataforma.idee.es/cnig-api`. No hay ATOM/bulk documentado en la propia página. |
| Idoneidad ingesta   | **ALTA** — fuente recomendada como base                                                                                                                                                                                                            |
| A verificar         | patrón exacto de URL de descarga directa por etapa/CCAA con API-CNIG; periodicidad de actualización (base 2018-2019, se actualiza por aportación de federaciones)                                                                                  |

---

## Tabla por federación autonómica

Leyenda idoneidad: **A** = portal propio accesible y reutilizable · **M** = web
con buscador/datos pero acceso a verificar · **W** = solo/principalmente Wikiloc
(no usable como dato) · todas quedan cubiertas además por **CNIG**.

| CCAA                   | Federación               | Portal de senderos                                                                                                                      | Acceso / formatos                                                     | Idoneidad       |
| ---------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------- |
| **C. Valenciana**      | FEMECV                   | `senders.femecv.com`                                                                                                                    | **YA INTEGRADO** (scrape HTML + GPX). Rico en metadatos               | — (base actual) |
| **País Vasco**         | EMF + diputaciones       | **Open Data Euskadi** `opendata.euskadi.eus/catalogo/-/senderos/`; Bizkaia `opengis.bizkaia.eus`; Gipuzkoa `gipuzkoairekia.eus`         | **WMS + WFS + GPX(zip) + KML**, **CC BY 4.0**, sin login              | **A** ⭐        |
| **Cataluña**           | FEEC                     | `senders.feec.cat` (~12.000 km)                                                                                                         | GPX **requiere login de federado** → usar CNIG. También canal Wikiloc | W/CNIG          |
| **Andalucía**          | FADMES (antes FEDAMON)   | `fadmes.es/red-de-senderos-andalucia`; directorio `infraestructuras.fadmes.es`                                                          | Buscador/directorio web; descarga a verificar                         | M               |
| **Aragón**             | FAM                      | `senderosfam.es/visor`                                                                                                                  | Visor; tracks vía **Wikiloc**                                         | W/CNIG          |
| **Galicia**            | FGM                      | `fedgalmon.gal`; turismo `turismo.gal`                                                                                                  | Catálogo lista/mapa; descarga a verificar                             | M               |
| **Castilla y León**    | FDMESCYL                 | `fclm.com/buscador-senderos-homologados`; `senderismocastillayleon.com`                                                                 | Buscador con **GPX por sendero**; app iSquad (~200+ senderos)         | M               |
| **Castilla-La Mancha** | FDMCM                    | `senderosdecastillalamancha.org`; `fdmcm.com/senderos`                                                                                  | Buscador mapa/lista; app iSquad; descarga a verificar                 | M               |
| **Navarra**            | FNDME                    | `senderos.nafarmendi.org`; IDENA (Gob. Navarra); `deportenavarra.es`                                                                    | Buscador con descarga de tracks; cartografía IDENA                    | M               |
| **Madrid**             | FMM                      | `fmm.es`                                                                                                                                | Tracks vía **Wikiloc** + app                                          | W/CNIG          |
| **Extremadura**        | FEXME                    | `fexme.com` (mapa senderos homologados, ~3.200 km); `rutasypaseos.redex.org`                                                            | Buscador; descarga a verificar                                        | M               |
| **Canarias**           | Cabildos / Gob. Canarias | **opendata** `opendata.gobiernodecanarias.org`; `senderosdecanarias.com` (KML/GPX por isla, p.ej. `grancanaria.senderosdecanarias.com`) | KML/GPX + open data; **red propia regulada** (ojo homologación)       | M/A             |
| **Murcia**             | FMRM                     | `fmrm.net/comites/comite-de-senderos`; agregador `murciapie.es`                                                                         | Web; descarga a verificar                                             | M/CNIG          |
| **Asturias**           | FEMPA                    | `fempa.net/deporte-de-montana/senderismo/rutas-y-senderos`                                                                              | Base de rutas; descarga a verificar                                   | M/CNIG          |
| **Cantabria**          | FCDME                    | `fcdme.es/senderos`                                                                                                                     | Buscador; descarga a verificar                                        | M/CNIG          |
| **Baleares**           | FBME                     | (portal de datos sin confirmar)                                                                                                         | —                                                                     | CNIG            |
| **La Rioja**           | FERIMON                  | `ferimon.com`; `senderioja.es`                                                                                                          | Poco portal de datos                                                  | CNIG            |

> Faltan por mapear con detalle: **Asturias/Cantabria/Baleares/Murcia/La Rioja/
> Andalucía/Galicia** (acceso exacto a fichero). Para todas, **CNIG cubre la
> geometría**; el portal propio solo se necesita para enriquecer metadatos.

---

## Endpoints clave verificados (detalle para implementación)

### 1. CNIG — base nacional

- Catálogo serie FEDME: `centrodedescargas.cnig.es/CentroDescargas/buscar.do?filtro.codFamilia=FEDME`
- Cubre las 17 CCAA, filtrable por CCAA/provincia/municipio/tipo.
- Descarga por **etapa** (GPX/KML) y por **tipo** (SHP). Atributos mínimos →
  enriquecer con portales propios / OSM.
- Nueva versión basada en **API-CNIG** ⇒ URLs estables por fichero/producto
  (pendiente fijar el patrón exacto; `…/servicios-web` y `plataforma.idee.es/cnig-api`).

### 2. Open Data Euskadi — mejor open data autonómico

- Catálogo: `opendata.euskadi.eus/catalogo/-/senderos/` (GR/PR; p. ej. GR 123
  «Bizkaiko Bira», 19 etapas).
- Formatos: **GPX (zip), KML, WMS, WFS**. Licencia **CC BY 4.0**.
- Ejemplos de servicio (Bizkaia, ArcGIS INSPIRE):
  - Descarga: `https://opengis.bizkaia.eus/?t=Sociedad/GR123/`
  - WFS: `https://geo.bizkaia.eus/arcgisserverinspire/services/Gizartea_Sociedad/GR123Ibilbidea_SenderoGR123/MapServer/WFSServer`
- Territorios: además Gipuzkoa (`gipuzkoairekia.eus`) y Federación Vizcaína
  (`bmf-fvm.org`).

### 3. FEMECV — base actual (referencia del patrón)

- `senders.femecv.com` (scrape de `…/es/senderos/index/{página}` + ficha + GPX),
  ver `scripts/ingest/crawl-cli.ts`. Es el modelo de «portal propio rico».

---

## Próximos pasos cuando se aborde V5-1

1. **Prueba de concepto CNIG**: descargar la serie FEDME de **una CCAA** (p. ej.
   Aragón, que en su web solo da Wikiloc) y validar geometría + matrícula
   (GR/PR-XX) + derivación de `federacion`/provincia/comarca.
2. **Modelo de datos**: añadir `federacion` y `source` a la ruta (zod), y la
   **atribución por fuente** (ya hay hueco en la UI v6). Decidir clave de id
   multi-federación (hoy los id son slugs FEMECV).
3. **Ingesta multi-fuente**: generalizar `crawl` a varios «adaptadores» (CNIG,
   Open Data Euskadi, FEMECV…) con interfaz común → `build` → `enrich`.
4. **Verificar acceso real** de los portales marcados «M» (descarga directa vs.
   login vs. Wikiloc) antes de depender de ellos para enriquecer.
5. **Licencias**: registrar la atribución de cada fuente en `/creditos` y en
   `sources` por ruta (IGN CC-BY, CC BY 4.0 Euskadi, condiciones FEEC, etc.).

## Fuentes consultadas (2026-06-28)

- CNIG/IGN Centro de Descargas — Senderos FEDME: `centrodedescargas.cnig.es/CentroDescargas/senderos-fedme`,
  `…/buscar.do?filtro.codFamilia=FEDME`, `…/servicios-web`; blog IDEE «nueva
  versión del Centro de Descargas» (API-CNIG); `cartografiadigital.es` (estructura
  del producto).
- FEDME: `fedme.es` (anuncio CNIG), `misendafedme.es` (registro de senderos).
- Open Data Euskadi: `opendata.euskadi.eus/catalogo/-/senderos/`; Bizkaia
  `opengis.bizkaia.eus` / `geo.bizkaia.eus`.
- FEEC `senders.feec.cat`; FADMES `fadmes.es`; FAM `senderosfam.es`; FGM
  `fedgalmon.gal`; FDMESCYL `fclm.com`; FDMCM `senderosdecastillalamancha.org`;
  FNDME `senderos.nafarmendi.org`; FMM `fmm.es`; FEXME `fexme.com`; Canarias
  `opendata.gobiernodecanarias.org` / `senderosdecanarias.com`; FMRM `fmrm.net`;
  FEMPA `fempa.net`; FCDME `fcdme.es`; FERIMON `ferimon.com`.
