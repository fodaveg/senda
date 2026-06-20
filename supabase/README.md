# Backend opcional (v4) — activación a coste 0

La v4 añade **cuentas y sincronización** como algo **opcional**: la app funciona
100% en local sin nada de esto. El backend se "enciende" cuando quieras, **gratis**.

## Decisión de coste (SPECS_V4 §10)

- **Proveedor recomendado para empezar: Supabase Cloud, plan GRATIS, región UE
  (Frankfurt).** Trae Auth (OTP, recuperación, sesiones), Postgres con RLS y envío
  de correo, sin servidor que pagar ni mantener. **0 €.**
- El plan gratis pausa el proyecto tras ~1 semana de inactividad; para un uso
  privado y esporádico es aceptable (se reactiva solo). Si algún día crece o se
  hace público, se migra a **Supabase self-host en Hetzner** (mejor valor EU) sin
  tocar el código de la app (el SDK está aislado tras `src/lib/auth`).

## Aislamiento de datos (lo que pediste)

Cada persona —incluido el dueño— **solo ve y escribe sus propias filas**: todas
las tablas llevan `user_id` y **RLS en "deny por defecto"** con una única política
`auth.uid() = user_id` (ver `schema.sql`). La analítica es **anónima** (sin
`user_id`, solo-inserción, nadie lee filas crudas; los rankings salen de una vista
agregada). Tus datos quedan separados de los de cualquier otro desde el día uno,
aunque haya pocas cuentas.

## Pasos de activación (cuando decidas)

1. Crear proyecto en https://supabase.com (plan Free, región **Central EU /
   Frankfurt**).
2. SQL Editor → pegar y ejecutar `supabase/schema.sql`.
3. Authentication → activar Email (y, opcional, TOTP para el OTP reforzado).
4. Copiar **Project URL** y **anon key** y exponerlas como variables públicas de
   build:
   ```
   PUBLIC_SUPABASE_URL=...
   PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (En GitLab CI: Settings → CI/CD → Variables.) Mientras no estén, la app no
   ofrece login y sigue en modo local (`src/lib/config.ts`).
5. Instalar el SDK (`@supabase/supabase-js`) e implementar el adaptador de
   `AuthClient` (`src/lib/auth/`) y el repositorio sincronizado (pendiente, ver
   SPECS_V4 §A1/§A3). Hasta ese paso no se añade la dependencia, para no engordar
   el bundle de una función que es un "por si acaso".

## Pendiente antes de hacerlo público (no bloquea el desarrollo)

- **Licencias**: revisar la redistribución de los datos (FEMECV, IGN CC-BY, OSM
  ODbL) y publicar atribución/uso conforme. Anotado en SPECS_V4.
- **RGPD**: política de privacidad, consentimiento de analítica, export/borrado de
  cuenta (ya contemplados en el diseño).
