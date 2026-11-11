-- ═══════════════════════════════════════════════════════════════════
--  ChronoBike · Esquema de base de datos para Supabase (PostgreSQL)
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO → Run
--  Se puede ejecutar varias veces sin romper nada (idempotente).
-- ═══════════════════════════════════════════════════════════════════

-- ── Tablas ──────────────────────────────────────────────────────────

-- EVENTOS (antes hoja "EVENTOS")
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  date        date not null,
  start_at    timestamptz,                 -- salida general (fecha + hora)
  lap_km      numeric(6,2),                -- opcional, para velocidad promedio
  status      text not null default 'proximo' check (status in ('proximo','en_curso','finalizado')),
  created_at  timestamptz not null default now()
);

-- CATEGORÍAS (antes hoja "CATEGORIAS")
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  laps        int  not null default 1 check (laps between 1 and 50),
  color       text not null default '#ff5a1f',
  sort        int,
  created_at  timestamptz not null default now()
);
create unique index if not exists categories_name_uq on public.categories (lower(name));

-- EQUIPOS (antes hoja "Equipos")
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort        int,
  created_at  timestamptz not null default now()
);
-- Evita duplicados tipo "Zorros MTB" / "ZORROS MTB"
create unique index if not exists teams_name_uq on public.teams (lower(trim(name)));

-- CORREDORES (antes hoja "CORREDORES")
create table if not exists public.riders (
  id          uuid primary key default gen_random_uuid(),
  dorsal      int  not null unique check (dorsal > 0),
  name        text not null,
  category_id uuid references public.categories(id) on delete set null,
  team_id     uuid references public.teams(id) on delete set null,
  photo_url   text,                        -- foto reducida (data URL) o URL pública
  created_at  timestamptz not null default now()
);

-- SALIDAS POR CATEGORÍA EN CADA EVENTO  (NUEVO)
-- Corrige el error del sistema anterior: la hora de salida estaba en la
-- categoría (sin fecha) y se compartía entre todos los eventos.
create table if not exists public.event_categories (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  laps        int check (laps between 1 and 50),   -- vueltas para ESTE evento (opcional)
  start_at    timestamptz,                          -- hora exacta de salida de la categoría
  unique (event_id, category_id)
);

-- PASOS POR META / VUELTAS (antes hoja "Registro")
create table if not exists public.laps (
  id          uuid primary key default gen_random_uuid(),  -- lo genera el celular (permite modo offline sin duplicar)
  event_id    uuid not null references public.events(id) on delete cascade,
  dorsal      int  not null,
  ts          timestamptz not null,        -- momento exacto en que se tocó REGISTRAR (precisión ms)
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists laps_event_idx on public.laps (event_id, ts);

-- STAFF: quién puede registrar datos
create table if not exists public.staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'registrador' check (role in ('admin','registrador')),
  created_at  timestamptz not null default now()
);

-- ── Funciones de permisos ──────────────────────────────────────────
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin') $$;

-- ── Seguridad por filas (RLS) ──────────────────────────────────────
--  · Público (sin sesión): SOLO LECTURA de eventos, categorías, equipos, corredores y vueltas
--  · Registrador: además registra/borra vueltas, da salidas e inscribe corredores
--  · Admin: todo
alter table public.events           enable row level security;
alter table public.categories       enable row level security;
alter table public.teams            enable row level security;
alter table public.riders           enable row level security;
alter table public.event_categories enable row level security;
alter table public.laps             enable row level security;
alter table public.staff            enable row level security;

do $$
declare t text;
begin
  foreach t in array array['events','categories','teams','riders','event_categories','laps'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select using (true)', t);
  end loop;
end $$;

-- Admin: escritura total en catálogos
drop policy if exists "admin escribe" on public.events;
create policy "admin escribe" on public.events for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin escribe" on public.categories;
create policy "admin escribe" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- Staff (admin o registrador): corredores, equipos, salidas y vueltas
drop policy if exists "staff escribe" on public.riders;
create policy "staff escribe" on public.riders for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff escribe" on public.teams;
create policy "staff escribe" on public.teams for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff escribe" on public.event_categories;
create policy "staff escribe" on public.event_categories for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff escribe" on public.laps;
create policy "staff escribe" on public.laps for all using (public.is_staff()) with check (public.is_staff());

-- Staff: cada quien ve su rol; admins ven y gestionan a todos
drop policy if exists "ver staff" on public.staff;
create policy "ver staff" on public.staff for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin gestiona staff" on public.staff;
create policy "admin gestiona staff" on public.staff for all using (public.is_admin()) with check (public.is_admin());

-- ── Tiempo real (la vista pública se actualiza sola) ───────────────
do $$
declare t text;
begin
  foreach t in array array['events','categories','teams','riders','event_categories','laps'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- ── Vista de apoyo: vueltas con datos del corredor (útil para reportes/Excel) ──
create or replace view public.laps_detalle with (security_invoker = true) as
select l.id, e.name as evento, l.dorsal, r.name as corredor, c.name as categoria, t.name as equipo,
       l.ts at time zone 'America/Hermosillo' as hora_local, l.ts
from public.laps l
join public.events e on e.id = l.event_id
left join public.riders r on r.dorsal = l.dorsal
left join public.categories c on c.id = r.category_id
left join public.teams t on t.id = r.team_id;

-- ═══════════════════════════════════════════════════════════════════
--  ALTA DEL PRIMER ADMINISTRADOR
--  1) Supabase → Authentication → Users → "Add user" (correo + contraseña,
--     marca "Auto Confirm User").
--  2) Ejecuta (cambiando el correo):
--
--  insert into public.staff (user_id, email, role)
--  select id, email, 'admin' from auth.users where email = 'tu-correo@ejemplo.com'
--  on conflict (user_id) do update set role = excluded.role;
--
--  Para un registrador usa 'registrador' en lugar de 'admin'.
-- ═══════════════════════════════════════════════════════════════════
