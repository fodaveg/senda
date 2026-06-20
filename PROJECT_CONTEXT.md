# PROJECT_CONTEXT.md

Fotografía **breve y actual** del proyecto. Mantener compacto: al cerrar una
tarea, actualizar el estado, no acumular histórico (el detalle vive en
`SPECS_V3_PROGRESS.md` y en el historial de git).

_Actualizado: 2026-06-20._

## Estado actual

- **v1** (M1–M7) y **v2** (V2-M1…M8) completas y en uso local.
- **v3**: sus **7 milestones están implementados** en la rama **`v3`**, pendiente
  de validar y mergear a `main`.
- `main` = web desplegada en GitLab Pages (dominio único, servida en la raíz).

## v3 — qué incluye (referencia: SPECS_V3.md)

M1 mapa (capas IGN topo/satélite, track visible, pins inicio/fin) · M2 agua y
POIs en el mapa (fuente: OSM) con toggles · M3 etapas (relación padre↔etapas,
"Ver Etapas" funcional) · M4 descubrimiento (filtro provincia, fix enlace "Cómo
llegar") · M5 perfil de elevación bicolor + tooltip legible · M6 mochila con
material custom y aviso `warn` · M7 apariencia (toggle de tema + paletas).

## Decisiones vigentes

- **Sin backend en v3.** Cuentas, login/OTP, recuperación de contraseña y
  analítica central → **v4** (requiere backend; proveedor sin decidir,
  recomendado **Supabase**).
- Tema/paleta de color en **Ajustes** (no backoffice). Datos de usuario
  **anonimizables/exportables** para la futura agregación v4 (sin recopilar nada
  aún).
- **POIs**: FEMECV no los publica geolocalizados → fuente **OSM**
  (mirador/cumbre/patrimonio/refugio; nombre+tipo, **sin imágenes**).
- **Popularidad**: descartada (FEMECV no expone visitas/descargas/ranking).

## Prioridades actuales

1. Terminar el **re-enrich completo** de agua/POIs (en curso) → `npm run ingest
-- --lenient` → commitear el dato completo en `v3`.
2. **Backlog de pulido** ([SPECS_V3_PULIDO.md](SPECS_V3_PULIDO.md)), prioridad
   [A] primero.
3. Validar `v3` y **mergear a `main`** (la CI publica a Pages).

## Bloqueos

- El **cron cloud no puede hacer push al GitLab privado** (desactivado). Para
  trabajo nocturno autónomo: espejo en GitHub o script wrapper local.
- **v4** a la espera de la decisión de backend.

## Áreas activas

- Datos: re-enrich OSM (agua/POIs) — proceso en background.
- Pulido de v3 (ver backlog).

## Documentación

- **Permanente**: `CLAUDE.md`, `ARCHITECTURE.md`.
- **Specs (referencia puntual, no leer enteras)**: `SPEC.md` (v1), `SPECS_V2.md`
  (v2), `SPECS_V3.md` (deltas v3).
- **Vivo v3**: `SPECS_V3_PROGRESS.md` (progreso/decisiones detalladas),
  `SPECS_V3_PULIDO.md` (backlog de pulido).
