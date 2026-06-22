-- Esquema del backend opcional de Senderos CV (SPECS_V4 §A5).
-- Postgres + RLS. Principio: AISLAMIENTO POR USUARIO desde el día uno — cada
-- persona solo ve y escribe SUS filas (incluido el dueño del proyecto). RLS en
-- "deny por defecto": ninguna tabla es accesible sin una política explícita.
--
-- Aplicar en el SQL Editor del proyecto Supabase (gratis). El script es
-- RE-EJECUTABLE de forma segura: usa "if not exists" en tablas/índices y
-- "drop ... if exists" antes de políticas y constraints (que no admiten
-- "if not exists"). Puedes pegarlo varias veces sin que aborte.

-- ─── Datos de usuario (sincronización, SPECS_V4 §B2) ────────────────────────
-- Todas llevan user_id (= auth.uid()) y updated_at para la fusión LWW (§A2),
-- y "deleted" como tombstone donde aplica.

create table if not exists route_marks (
  user_id     uuid not null references auth.users on delete cascade,
  route_id    text not null,
  favorita    boolean not null default false,
  me_gusta    boolean not null default false,
  quiero_hacer boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, route_id)
);

create table if not exists outings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  route_id    text not null,
  date        date not null,
  notes       text,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists checklists (
  user_id     uuid not null references auth.users on delete cascade,
  route_id    text not null,
  date        date not null,
  checked_ids text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, route_id, date)
);

create table if not exists custom_gear (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  category    text not null,
  weight_g    integer,
  attributes  text[] not null default '{}',
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists preferences (
  user_id     uuid primary key references auth.users on delete cascade,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

create table if not exists profiles (
  user_id       uuid primary key references auth.users on delete cascade,
  display_name  text,
  personal_data jsonb not null default '{}', -- datos de emergencia (opcionales)
  updated_at    timestamptz not null default now()
);

-- Límite de tamaño de datos personales (evita abuso de almacenamiento en la
-- propia fila; el usuario solo puede escribir la suya). [auditoría B2]
alter table profiles drop constraint if exists personal_data_size;
alter table profiles add constraint personal_data_size
  check (pg_column_size(personal_data) < 16384);

-- ─── RLS: cada usuario, solo lo suyo ────────────────────────────────────────
alter table route_marks enable row level security;
alter table outings     enable row level security;
alter table checklists  enable row level security;
alter table custom_gear enable row level security;
alter table preferences enable row level security;
alter table profiles    enable row level security;

-- Política única por tabla: el dueño de la fila (auth.uid() = user_id) puede
-- todo; el resto, nada. (Repetir el patrón para cada tabla.)
-- "drop policy if exists" hace el script re-ejecutable [auditoría A1].
drop policy if exists "own rows" on route_marks;
create policy "own rows" on route_marks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on outings;
create policy "own rows" on outings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on checklists;
create policy "own rows" on checklists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on custom_gear;
create policy "own rows" on custom_gear for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on preferences;
create policy "own rows" on preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on profiles;
create policy "own rows" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Privilegios de tabla para el rol "authenticated". RLS filtra filas, pero
-- PostgREST exige además el privilegio de tabla; lo declaramos explícito para no
-- depender de los default privileges del entorno [auditoría A2].
grant select, insert, update, delete
  on route_marks, outings, checklists, custom_gear, preferences, profiles
  to authenticated;

-- ─── Analítica ANÓNIMA y opt-in (SPECS_V4 §B3, §11) ─────────────────────────
-- Sin user_id: eventos no reidentificables. Solo-inserción para usuarios
-- autenticados; NADIE puede leer filas crudas (privacidad). Los rankings se
-- sirven desde vistas agregadas con k-anonimato (abajo).
create table if not exists analytics_events (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('favorita','completada','material')),
  -- clave anónima del objeto: route_id para rutas; nombre normalizado + atributos
  -- para material. NUNCA datos personales.
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- El payload debe ser un objeto con la clave esperada y SIN PII: barrera de BD
-- contra que un cliente manipulado almacene datos personales [auditoría M1].
alter table analytics_events drop constraint if exists payload_shape;
alter table analytics_events add constraint payload_shape check (
  jsonb_typeof(payload) = 'object'
  and (payload ? 'route_id' or payload ? 'name')
  and not (payload ? 'user_id' or payload ? 'email')
);

-- Índice para la agregación de los rankings [auditoría M3].
create index if not exists analytics_events_kind_route_idx
  on analytics_events (kind, (payload->>'route_id'));

alter table analytics_events enable row level security;
drop policy if exists "insert only, authenticated" on analytics_events;
create policy "insert only, authenticated" on analytics_events for insert
  to authenticated with check (true);
-- (sin policy de select → nadie lee filas crudas)
grant insert on analytics_events to authenticated;
-- La columna "id generated always as identity" usa una secuencia; "authenticated"
-- necesita permiso sobre ella para poder insertar [auditoría A2].
grant usage, select on sequence analytics_events_id_seq to authenticated;

-- Rankings agregados, legibles por cualquiera (no exponen eventos individuales).
-- "security_invoker = off": la vista corre como owner para poder agregar
-- saltándose el RLS de analytics_events; lo fijamos explícito en vez de confiar
-- en el default [auditoría C1]. "having n >= 5": k-anonimato, no se publica un
-- ranking hasta que hay suficientes eventos para que no se pueda reidentificar
-- (umbral ajustable) [auditoría C3].
create or replace view trending_routes
  with (security_invoker = off) as
  select payload->>'route_id' as route_id, kind, count(*) as n
  from analytics_events
  where kind in ('favorita','completada')
  group by 1, 2
  having count(*) >= 5;

-- Material más llevado (simétrico; alimenta qué añadir al catálogo por defecto).
create or replace view trending_gear
  with (security_invoker = off) as
  select payload->>'name' as name, count(*) as n
  from analytics_events
  where kind = 'material'
  group by 1
  having count(*) >= 5;

-- Las vistas necesitan GRANT explícito para ser legibles vía PostgREST por los
-- roles del cliente [auditoría C2].
grant select on trending_routes, trending_gear to anon, authenticated;
