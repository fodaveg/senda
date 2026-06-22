# SPECS V5 — Senderos CV (Senda)

Documento **exploratorio** de la versión 5: deltas sobre [SPEC.md](SPEC.md) (v1),
[SPECS_V2.md](SPECS_V2.md), [SPECS_V3.md](SPECS_V3.md) y [SPECS_V4.md](SPECS_V4.md).
A diferencia de las anteriores, esto **aún no es un plan cerrado**: es un menú de
ideas para decidir alcance, más un inventario de la **deuda heredada** que
conviene saldar antes o durante la v5.

Reglas vigentes salvo que una idea diga lo contrario: offline-first, no inventar
datos (dato no verificado → `null` + `sources`), lógica de negocio pura sin
Svelte, zod en los límites, degradación elegante de lo online, Wikiloc solo como
enlace. Las ideas que **reabren** un principio se marcan ⚠️.

> **Cómo usar este doc:** primero la PARTE PRE (qué falta de v1–v4). Luego elegir
> 1–2 temas de la PARTE V5; el resto queda como backlog. No leer entero por
> defecto.

---

# PARTE PRE — Deuda heredada (pendiente de v1–v4)

Lo que quedó abierto en versiones anteriores. Saldar lo crítico antes de abrir
frente nuevo; mover lo menor a backlog permanente.

## PRE-A. v4 sin terminar (cuentas, sync, analítica, escala)

Estado vivo en [SPECS_V4_PROGRESS.md](SPECS_V4_PROGRESS.md). Hecho: M1 (repo de
datos), M2 (backend + auth), M3 núcleo (UI de cuentas). Falta:

- **M3 (cuentas) — rematar:**
  - OTP/TOTP (login reforzado).
  - **Borrar cuenta** (RGPD): requiere RPC/función de servidor (el cliente no
    puede borrar su propio usuario de `auth.users`).
  - **Exportar cuenta** (RGPD) y datos personales de emergencia sincronizados.
  - **Restablecer contraseña por enlace de correo**: ruta de callback + deep-link
    en Tauri (`ign://`).
  - **Config del proyecto Supabase**: fijar **Site URL** al dominio real (los
    enlaces de email iban a `localhost:3000`); **reactivar la confirmación de
    email** antes de publicar; borrar los usuarios de prueba.
- **M4 (sincronización) — no empezado:**
  - `updated_at`/tombstones en los esquemas locales (migración versionada).
  - `SyncedRepository` que use `merge.ts` (ya hecho y testeado) contra Supabase;
    **cola offline**; **indicador de estado de sync**.
  - **Migración de datos locales → cuenta** (A6) al iniciar sesión por primera vez.
- **M5 (analítica) — no empezado:** recogida **opt-in y anónima** + vistas de
  **tendencias** (las vistas `trending_routes`/`trending_gear` ya existen en el
  schema, con k-anonimato).
- **M6 (escala) — no empezado:** índice ligero + carga perezosa del catálogo,
  virtualización del listado, índice de búsqueda precomputado, **code-splitting
  del mapa** (MapLibre), clustering. _(Es el puente natural hacia la idea
  estrella de v5; ver V5-1.)_
- **M7 (extras B4) — a elegir:** web push de avisos, partes de comunidad,
  valoraciones, planificador, listas, plantillas de material.

## PRE-B. Legal y publicación (bloquea hacer público, no el desarrollo)

- **Licencias/atribución** de los datos redistribuidos: **FEMECV**, **IGN
  CC-BY**, **OSM ODbL**. Revisar y publicar atribución conforme antes de abrir la
  app a terceros.
- **RGPD**: política de privacidad, aviso de cookies/almacenamiento,
  consentimiento de analítica, export/borrado de cuenta (parte ya diseñado).

## PRE-C. Pulido v3 aún abierto (de SPECS_V3_PULIDO.md)

- **Accesibilidad del mapa** [B]: foco, `aria-label` y navegación por teclado de
  POIs; popups hoy solo on-hover de ratón. (Encaja con A11y de V5-7.)
- **Datos/enriquecimiento**: imagen/descripción **manual** de POIs en
  `_manual/<id>.json` [M]; **deduplicar POIs** cercanos del mismo nombre/tipo [M];
  revisar buffer de POIs (150 m) y tipos [B].
- **Etapas**: persistir `stages`/`parent_id` en el dato (hoy se deriva en runtime)
  [M]; agrupar/señalar etapas en el listado [B].
- **Mapa**: clustering de marcadores [B]; popup con distancia al track [B];
  verificar atribución al cambiar a PNOA [B].
- **Material custom**: editar un ítem ya creado (hoy solo alta/baja) [B]; ampliar
  vocabulario de atributos y anti-reglas [B].
- **Catálogo**: republicar en Pages (CI) con los campos nuevos [B]; recordar el
  origen del filtro provincia/comarca entre visitas [B].
- **Transversal**: **code-splitting** del bundle [M] (compartido con v4-M6);
  toggle de tema que cicle claro→oscuro→auto [B]; e2e de regresión visual/oscuro
  [B].

## PRE-D. i18n (deuda declarada desde v2; fuera de v4 por decisión del usuario)

Textos centralizados y traducción. Candidato natural: **valencià**. Si la v5 va
hacia multi-federación (V5-1), el i18n se vuelve casi obligatorio (català,
euskera, galego, aragonés según territorio). Decisión del usuario sobre si entra.

---

# PARTE V5 — Ideas (menú, no plan cerrado)

Cada tema es independiente; elegir 1–2 como hilo de la v5 y dejar el resto en
backlog. Orden = mi sugerencia de impacto, no de obligación.

## V5-1. Multi-federación y rediseño del descubrimiento ⭐ (la idea estrella)

Anclada en [SPECS_V4.md](SPECS_V4.md) §B6: con varias federaciones (miles de
rutas) el modelo "todas las rutas en memoria + listado plano" no escala, y la UI
de descubrimiento se queda corta.

- **Más federaciones**: abrir el catálogo a otras federaciones autonómicas (FEEC
  Cataluña, FAM Aragón, EMF Euskadi, FGM Galicia…) además de FEMECV. Cada ruta
  lleva `federacion`/`source` y su **atribución propia**.
- **Nueva navegación de descubrimiento**: entrada por **federación / territorio /
  mapa** en vez de un listado plano; **búsqueda federada**; **filtros
  jerárquicos** (federación → provincia → comarca → tipo → dificultad).
- **Escala técnica** (recoge v4-M6): índice ligero (id, nombre, bbox, comarca,
  tipo) + **carga perezosa** de la ficha; **virtualización** del listado; **índice
  de búsqueda** precomputado; **clustering** en mapa; code-splitting de MapLibre.
- **Reto de datos**: pipeline de ingesta multi-fuente (cada federación publica
  distinto); mantener la regla de no inventar y la trazabilidad por `sources`.

## V5-2. Modo "en ruta" (navegación y seguridad en vivo) ⚠️ (nuevos permisos)

Llevar Senda al terreno, no solo a la planificación.

- **Seguimiento GPS en vivo** sobre el track: posición, **aviso de desvío**,
  próximos POIs/agua, perfil y distancia restantes.
- **Seguridad**: hora límite de retorno (ya hay ventana de inicio v2 §5),
  **compartir ubicación en vivo** con un contacto, botón de **ayuda/112** con la
  ficha de emergencia (v2 §9) precargada.
- **Grabar tu track real** y compararlo con el oficial (alimenta el diario).
- ⚠️ Reabre: geolocalización en vivo (permiso), consumo de batería, y posible
  fondo. Sigue siendo offline-first (mapas y track ya cacheables).

## V5-3. Comunidad y contenido colaborativo ⚠️ (moderación + almacenamiento)

Aprovecha el backend de v4 (cuentas + RLS).

- **Partes de estado de ruta** (de v4-B4): "fuente seca", "puente cortado",
  "señalización perdida", con fecha, **caducidad** y **moderación**; se muestran
  en la ficha **etiquetados "reporte de usuario, sin verificar"** (no sustituyen
  al dato oficial FEMECV).
- **Valoraciones y notas** por ruta (privadas y públicas), que alimentan el diario.
- **Fotos de usuario** por ruta/POI ⚠️: implica almacenamiento (Supabase Storage),
  **moderación** y **privacidad** (quitar EXIF/geolocalización). Decidir si entra.
- **Rutas propuestas por usuarios** (GPX subido), siempre **claramente no
  homologadas** y separadas del catálogo oficial.

## V5-4. Planificación inteligente

- **Planificador / agenda de salidas** (v4-B4): fecha objetivo por ruta combinando
  ventana de inicio + meteo + avisos; base para los **web push** de seguridad.
- **Recomendador "rutas para hoy"**: según meteo, tu nivel (del diario), distancia
  desde tu origen y tus marcas; todo con datos verificados, sin inventar.
- **Itinerarios multi-día**: encadenar etapas con refugios y logística.
- **Listas/colecciones** ("con niños", "pendientes de verano") y compartir por
  enlace público opcional.

## V5-5. Más datos útiles (capas y avisos)

- **Transporte público a los inicios** de ruta (integración GTFS) y aparcamientos:
  "¿cómo llego sin coche?".
- **Capas nuevas**: refugios, espacios protegidos y **restricciones** (vedas,
  zonas de incendio, parques con acceso regulado) — solo dato oficial, etiquetado.
- **Relieve offline**: curvas de nivel / hillshade / sombras cacheables.
- Avisos AEMET y de **incendio forestal** más ricos y por fecha planificada.

## V5-6. Plataforma y distribución ⚠️ (nuevas plataformas)

- **App móvil nativa** (Tauri mobile o equivalente) para iOS/Android, además de
  escritorio + PWA. El terreno natural del senderismo es el móvil.
- **Paquetes de región descargables** (tiles + catálogo) para offline total por
  zona, no solo por ruta.
- **API/catálogo abierto** para terceros (si se decide abrir el dato agregado).

## V5-7. Accesibilidad e inclusión (salda PRE-C y PRE-D)

- **i18n completa** (valencià + lenguas de cada federación si entra V5-1).
- **WCAG en serio**: teclado, lectores de pantalla, foco visible, alto contraste
  (ya hay esquemas de color), tamaños de texto (ya hay escala).
- **Filtros de accesibilidad de rutas** donde el dato exista (movilidad reducida,
  apta para carrito), siempre sin inventar.

---

## Riesgos y decisiones del usuario (antes de fijar v5)

- **Foco**: la v5 puede ser "ancha" (multi-federación, V5-1) o "profunda" (modo en
  ruta, V5-2). Recomendado **elegir una** como hilo principal.
- **Coste/operación**: fotos de comunidad y multi-federación aumentan
  almacenamiento, ingesta y moderación. Revisar contra el principio "coste mínimo"
  de v4.
- **Legal**: multi-federación multiplica el trabajo de **licencias/atribución**
  (PRE-B); resolverlo antes de publicar nada agregado.
- **Saldar deuda primero**: terminar v4-M4 (sync) da sentido a las cuentas ya
  creadas; conviene antes de abrir features de comunidad que dependen de ellas.

> **Sugerencia de secuencia**: (1) cerrar v4-M4/M5 y la deuda legal mínima; (2)
> elegir hilo de v5 entre **V5-1 (escala/federaciones)** y **V5-2 (modo en ruta)**;
> (3) el resto, backlog.
