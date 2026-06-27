# SPECS V5 — Investigación de fuentes: federaciones de montaña de España

> **Para V5-1 (multi-federación).** Mapa de fuentes de datos de senderos
> homologados (GR/PR/SL) de las federaciones española y autonómicas, con vistas
> al **pipeline de ingesta**. Solo **España**. _Investigado: 2026-06-28_ (mezcla
> de conocimiento + verificación web; las URLs marcadas «verificar» no se han
> confirmado a nivel de fichero descargable).

## Conclusión / recomendación estratégica

**Hay una fuente nacional, oficial, descargable y con licencia compatible que
agrega TODAS las federaciones: el Centro de Descargas del CNIG (IGN), serie
«Senderos FEDME».** ~50.000 km de GR/PR/SL en **GPX, KML y SHP**, filtrable por
comunidad autónoma / provincia / municipio. Licencia **IGN (CC-BY)** — la misma
familia que ya usamos para los tiles.

Por tanto, el plan de ingesta multi-federación **no necesita raspar 17 webs**
(muchas solo publican sus tracks en **Wikiloc**, que nuestra regla prohíbe como
fuente de datos). La arquitectura recomendada:

1. **Columna vertebral = CNIG/FEDME** → geometría (GPX) + cobertura nacional +
   `federacion`/CCAA derivada del código del sendero y del área administrativa.
   Metadatos pobres (ID, nombre de etapa, longitud, fecha de edición).
2. **Enriquecimiento por portal propio** donde sea **accesible y con licencia
   clara**: FEMECV (ya integrado), **Open Data Euskadi** (open data real), y los
   buscadores de CyL / CLM / Navarra / Extremadura / Canarias para dificultad,
   agua, descripción, etc. — igual que hoy enriquecemos con OSM.
3. **Wikiloc NUNCA como dato** (regla permanente): es enlace saliente. Varias
   federaciones (FAM Aragón, FMM Madrid, CyL…) publican ahí; se ignoran como
   origen de datos.

Esto encaja con el pipeline actual `crawl → build → enrich` (`scripts/ingest/`):
el CNIG sustituiría/ampliaría la fase `crawl` (descarga de GPX + índice), y los
portales propios entrarían como fuentes de `enrich` (como `enrich/osm.ts`).

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
