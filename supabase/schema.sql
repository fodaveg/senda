-- Esquema del backend opcional de Senderos CV (SPECS_V4 §A5).
-- Postgres + RLS. Principio: AISLAMIENTO POR USUARIO desde el día uno — cada
-- persona solo ve y escribe SUS filas (incluido el dueño del proyecto). RLS en
-- "deny por defecto": ninguna tabla es accesible sin una política explícita.
--
-- Aplicar en el SQL Editor del proyecto Supabase (gratis). Idempotente-ish:
-- usa "if not exists" donde se puede.

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

-- ─── RLS: cada usuario, solo lo suyo ────────────────────────────────────────
alter table route_marks enable row level security;
alter table outings     enable row level security;
alter table checklists  enable row level security;
alter table custom_gear enable row level security;
alter table preferences enable row level security;
alter table profiles    enable row level security;

-- Política única por tabla: el dueño de la fila (auth.uid() = user_id) puede
-- todo; el resto, nada. (Repetir el patrón para cada tabla.)
create policy "own rows" on route_marks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on outings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on checklists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on custom_gear for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Analítica ANÓNIMA y opt-in (SPECS_V4 §B3, §11) ─────────────────────────
-- Sin user_id: eventos no reidentificables. Solo-inserción para usuarios
-- autenticados; NADIE puede leer filas crudas (privacidad). Los rankings se
-- sirven desde una vista agregada (abajo).
create table if not exists analytics_events (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('favorita','completada','material')),
  -- clave anónima del objeto: route_id para rutas; nombre normalizado + atributos
  -- para material. NUNCA datos personales.
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
alter table analytics_events enable row level security;
create policy "insert only, authenticated" on analytics_events for insert
  to authenticated with check (true);
-- (sin policy de select → nadie lee filas crudas)

-- Ranking agregado, legible por cualquiera (no expone eventos individuales).
create or replace view trending_routes as
  select payload->>'route_id' as route_id, kind, count(*) as n
  from analytics_events
  where kind in ('favorita','completada')
  group by 1, 2;
