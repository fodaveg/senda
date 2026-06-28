# SPECS V5 — Dosier de endpoints por CCAA (ingesta multi-federación)

> **A qué atacar en el ingest y en las actualizaciones, comunidad por comunidad.**
> Complementa `SPECS_V5_FEDERACIONES.md` (estrategia + modelo acordado + PoC
> Navarra). _Investigado: 2026-06-28._ Solo **España**.
>
> **Confianza**: ✅ verificado con datos reales · 🟡 endpoint IDE identificado,
> capa de senderos por confirmar vía `GetCapabilities` · 🔴 sin open-data
> accesible (solo Wikiloc/login) → depender de CNIG/MiSendaFEDME.
>
> **Wikiloc nunca como fuente de datos** (regla permanente). Los GPX que aquí se
> citan son de IDE/CNIG/MiSendaFEDME, no de Wikiloc.

## Las 3 capas del modelo (recordatorio)

1. **Existencia + estado** → capa federación. Por defecto **MiSendaFEDME**
   (buscador nacional FEDME), endpoint único cambiando `ccaa=`:
   `POST https://misendafedme.es/buscador-de-senderos/inc/buscar_etapas_mapa.php`
   Devuelve JSON `{matricula, codi_matricula, titulo, permalink, id, arxiu(gpx),
gr_parent_*}`. **Solo lista senderos en vigor** ⇒ presencia ≈ homologado.
2. **Geometría (con licencia)** → **CNIG** serie FEDME (CC-BY) o el **WFS de la
   IDE regional** (cada uno con su licencia). MiSendaFEDME da GPX como respaldo
   (licencia a confirmar).
3. **Enriquecimiento** (estado oficial detallado, MIDE, agua, municipio…) →
   **IDE regional / open-data / portal de la federación**. Lo que ninguna fuente
   exponga → bloque oculto o capa "_(Federación X) no expone públicamente datos…_".

## Cobertura de la capa federación (MiSendaFEDME, Fase A, 2026-06-28)

Total nacional **3.359 etapas**. Recuento por CCAA (código `ccaa`):

| CCAA                      | etapas | senderos | prefijos matrícula                      | ¿MiSenda basta?                        |
| ------------------------- | ------ | -------- | --------------------------------------- | -------------------------------------- |
| Andalucía (`an`)          | 459    | 27       | GR, PR-A, SL-A                          | sí (alta)                              |
| Aragón (`ar`)             | 770    | 48       | GR, PR-HU/TE/Z, SL-TE/Z                 | sí (alta)                              |
| Asturias (`as`)           | 184    | 19       | GR, PR-AS                               | sí                                     |
| Illes Balears (`ib`)      | 23     | 2        | GR                                      | **no** → regional                      |
| Canarias (`cn`)           | 24     | 1        | GR                                      | **no** → regional                      |
| Cantabria (`cb`)          | 9      | 1        | PR-S, SL-S                              | **no** → regional                      |
| Castilla-La Mancha (`cm`) | 226    | 6        | GR, PR-/SL- (AB,CR,CU,GU,TO)            | parcial                                |
| Castilla y León (`cl`)    | 152    | 4        | GR, PR-/SL- (AV,BU,LE,P,SA,SG,SO,VA,ZA) | parcial                                |
| Cataluña (`ct`)           | 586    | 70       | GR, PR-C, SL-C                          | sí (alta)                              |
| Extremadura (`ex`)        | 148    | 8        | GR, PR-/SL- (BA,CC)                     | sí                                     |
| Galicia (`ga`)            | 35     | 5        | GR, PR-G                                | **no** → regional                      |
| La Rioja (`ri`)           | 0      | 0        | —                                       | **no** → regional obligatorio          |
| Madrid (`md`)             | 13     | 2        | GR, PR-M                                | **no** → regional                      |
| Murcia (`mc`)             | 86     | 6        | GR, PR-MU, SL-MU                        | parcial                                |
| Navarra (`nc`)            | 79     | 21       | GR, PR-NA, SL-NA                        | sí                                     |
| País Vasco (`pv`)         | 284    | 21       | GR, PR-BI/GI, SL-GI                     | sí (pero hay open-data mejor)          |
| C. Valenciana (`vc`)      | 274    | 11       | GR, PR-CV, SL-CV                        | **no se usa**: CV va por FEMECV (~585) |
| Ceuta (`ce`)              | 7      | 1        | PR-CE, SL-CE                            | sí                                     |
| Melilla (`ml`)            | 0      | 0        | —                                       | n/a                                    |

> Donde "MiSenda basta = no/parcial", el ingest **debe** apoyarse en la fuente
> regional para cobertura y/o estado.

---

## Ficha por CCAA

### Comunitat Valenciana — FEMECV — (base actual, no se toca)

- **Fuente**: `senders.femecv.com` (scrape HTML + GPX; `scripts/ingest/`).
- Metadatos ricos (estado, MIDE, agua, etapas…). Más completa que MiSenda (274).
- Confianza ✅ (en producción).

### Navarra — FNDME — ✅ verificado (PoC)

- **Existencia/estado**: MiSendaFEDME `ccaa=nc` (79 etapas) + lista oficial de
  **deportenavarra.es/senderos-homologados-rehomologados** (estado homologado/
  rehomologado/baja). FNDME delega su buscador en MiSendaFEDME.
- **Geometría oficial (CC-BY)**: **IDENA WFS** — una capa por sendero,
  `IDENA:DOTACI_Lin_GR11`, `IDENA:DOTACI_Lin_PRNA121`, … (casan con la matrícula).
  `https://idena.navarra.es/ogc/wfs?service=WFS&request=GetCapabilities`
- **Enriquecimiento**: IDENA (geometría/longitud); MIDE/agua **no expuestos** →
  overlay. Ver `scripts/ingest/poc/navarra.mjs`.

### País Vasco — EMF + diputaciones — ✅ verificado

- **Open Data Euskadi** (CC BY 4.0): `opendata.euskadi.eus/catalogo/-/senderos/`.
- Diputaciones (geometría + WFS): Bizkaia `geo.bizkaia.eus/arcgisserverinspire/...`
  (descarga `opengis.bizkaia.eus`), Gipuzkoa `gipuzkoairekia.eus`.
- Formatos: GPX/KML/WMS/WFS. MiSenda `pv`=284 como respaldo de existencia.

### Andalucía — FADMES — 🟢 (atributos ricos conocidos, capa por confirmar)

- **REDIAM WMS/WFS** "Mapa de Equipamientos y **Senderos de Uso Público** de
  Andalucía" — vector con **trazado, nombre, dificultad, distancia, duración,
  inicios** (actualizado may-2026). Catálogo:
  `https://www.ideandalucia.es/catalogo/inspire/srv/spa/catalog.search` ·
  Portal OGC: `juntadeandalucia.es/medioambiente/portal/...servicios-ogc`.
- También **DERA** (IECA) en SHP/GeoPackage + WMS/WFS.
- Existencia: MiSenda `an`=459.

### Aragón — FAM — 🟡

- **IDEARAGON / ICEARAGON** WFS: `https://idearagon.aragon.es/Visor2D?service=WFS&request=GetCapabilities`
  (capa de senderos por localizar). Directorio: `idearagon.aragon.es/directorio_ws.jsp`.
- La web de la FAM (`senderosfam.es`) solo da tracks vía Wikiloc 🔴 → usar
  MiSenda `ar`=770 (alta) + IDEARAGON para enriquecer.

### Cataluña — FEEC — 🟡

- **ICGC** geoservicios WMS/WFS + open data: `https://www.icgc.cat/...Online-services-Geoservices`,
  recursos en obert `https://openicgc.github.io/`. App "Catalunya Offline" (ICGC+FEEC).
- `senders.feec.cat` (GPX tras login 🔴). Existencia: MiSenda `ct`=586 (alta).

### Galicia — FGM — 🟡 (regional necesario; MiSenda solo 35)

- **IDEG / Información Xeográfica de Galicia** `https://mapas.xunta.gal/` —
  geoportal + **Centro de descargas** (>46.900 ficheros) + WMS/WFS.
- Portal federación `fedgalmon.gal`. Confirmar capa de senderos en IDEG.

### Asturias — FEMPA — 🟡

- **SITPA-IDEAS** `https://ideas.asturias.es/` (WFS + descargas) + `asturias.es`
  (rutas). MiSenda `as`=184. Confirmar capa senderos en SITPA.

### Cantabria — FCDME — 🟡 (regional necesario; MiSenda solo 9)

- **IDE Cantabria**: `https://geoservicios.cantabria.es/` (WFS; "invertir ejes" al
  conectar), visor `https://mapas.cantabria.es/`, servicios
  `territoriodecantabria.es/cartografia-sig/servicios-wfs-iig`. + `fcdme.es/senderos`.

### Castilla-La Mancha — FDMCM — 🟡

- **IDE-CLM / Portal de Mapas** + **open data ArcGIS**
  `https://datos-abiertos-castillalamancha.opendata.arcgis.com/` (descarga directa
  GeoJSON/SHP/CSV) + `senderosdecastillalamancha.org`. MiSenda `cm`=226.

### Castilla y León — FDMESCYL — 🟡

- **IDECyL** `https://cartografia.jcyl.es/web/es/idecyl.html` (listado de servicios
  WMS/WFS; IDECyL publicó bloque de senderos) + open data `datosabiertos.jcyl.es`
  - buscador federación `fclm.com/buscador-senderos-homologados` (GPX por sendero).
    MiSenda `cl`=152.

### Extremadura — FEXME — 🟡

- **SITEX / IDEEX** `http://sitex.juntaex.es/SITEX/centrodescargas` + visor
  `https://visor.ideex.es/`. Portal federación `fexme.com` (mapa, ~3.200 km).
  MiSenda `ex`=148.

### Murcia — FMRM — 🟡

- **Cartomur / IDERM** `https://www.cartomur.com` / `https://sitmurcia.carm.es/servicios`
  (WMS/WFS/CSW) + agregador `murciapie.es`. MiSenda `mc`=86.

### Canarias — Cabildos / Gob. Canarias — 🟡 (regional necesario; MiSenda solo 24)

- **IDECanarias / GRAFCAN** (~200 servicios WMS/WFS):
  `https://www.idecanarias.es/listado_servicios` (localizar servicio de senderos)
  - **opendata** `https://opendata.gobiernodecanarias.org/opendata/` +
    `senderosdecanarias.com` (KML/GPX por isla, p. ej. `grancanaria.senderosdecanarias.com`).
- **Red de senderos propia** regulada por Cabildos (no siempre marca GR/PR FEDME)
  → tratar `federacion`/atribución específica.

### Madrid — FMM — 🟡 (regional necesario; MiSenda solo 13)

- **IDEM** `https://idem.madrid.org/` (visor + catálogo
  `idem.comunidad.madrid/catalogocartografia`, descarga SHP) + `sendasdemadrid.es`.
- `fmm.es` solo tracks vía Wikiloc 🔴.

### Illes Balears — FBME — 🟡 (regional necesario; MiSenda solo 23)

- **IDEIB** `https://www.ideib.cat/` (WMS/WFS/CSW). Confirmar capa camins/senders.

### La Rioja — FERIMON — 🟡 (regional OBLIGATORIO; MiSenda 0)

- **IDERioja** `https://www.iderioja.larioja.org/` — WFS temático que incluye
  `actividades_al_aire_libre` y `puntos_de_interes_de_senderos`. Portal
  `senderioja.es`. Sin MiSenda, IDERioja es la fuente principal aquí.

### Asturias/Ceuta/Melilla y otras

- **Ceuta** (`ce`=7) y **Melilla** (`ml`=0): cobertura mínima; CNIG/MiSenda.

---

## Cómo se ataca en el ingest (resumen operativo)

1. **Capa federación / existencia / estado**: 1 llamada por CCAA a MiSendaFEDME
   (`ccaa=<código>`). Donde la cobertura sea baja (ib, cn, cb, ga, ri, md),
   **complementar con la IDE regional** (y para Navarra, la lista de
   deportenavarra.es para estado).
2. **Geometría**: CNIG serie FEDME (CC-BY) o WFS de la IDE regional; unir por
   **matrícula + nombre + proximidad**.
3. **Enriquecimiento**: WFS/open-data de cada IDE (atributos: nombre, dificultad,
   distancia, duración, inicio…; ricos en Andalucía REDIAM). Lo no expuesto →
   overlay "(Federación X) no expone públicamente datos…".
4. **Actualizaciones**: las IDE/WFS y MiSendaFEDME son consultables periódicamente;
   guardar `fetched_at`/fecha de edición por fuente en `sources` (no inventar).

> **Pendiente al implementar V5-1**: confirmar el `typeName` exacto de la capa de
> senderos en cada IDE vía `GetCapabilities` (verificado solo en Navarra/IDENA y
> Euskadi/Bizkaia), y la **licencia** de cada WFS regional. La tabla de cobertura
> es reproducible: `node scripts/ingest/poc/federaciones-cobertura.mjs`.
