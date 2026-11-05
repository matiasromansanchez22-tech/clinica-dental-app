-- Migración 190: inventario de instrumental.
--
-- Cada instrumental tiene una cantidad "buena" y una "para reparar" en cada ubicación (consultorios, esterilización,
-- depósito...). Las cantidades solo cambian a través de novedades (alta, roto, perdido, a reparar, reparado, repuesto,
-- movido) o de un conteo, y todo queda registrado con quién lo hizo.
--
-- Solo pueden verlo y cargarlo las Dueñas y Laboratorio.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- Quién puede ver y cargar el inventario: las dueñas y Laboratorio (Yamila).
create or replace function puede_inventario_instrumental()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('Duena', 'Laboratorio'));
$$;

create table if not exists instrumental_ubicaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
insert into instrumental_ubicaciones (nombre, orden) values
  ('Consultorio 1', 1), ('Consultorio 2', 2), ('Consultorio 3', 3), ('Esterilización', 4), ('Depósito', 5)
on conflict (nombre) do nothing;

create table if not exists instrumental_items (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  categoria text not null default 'Otros',
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists instrumental_cantidades (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references instrumental_items(id) on delete cascade,
  ubicacion_id uuid not null references instrumental_ubicaciones(id) on delete cascade,
  buenos int not null default 0 check (buenos >= 0),
  a_reparar int not null default 0 check (a_reparar >= 0),
  unique (item_id, ubicacion_id)
);

create table if not exists instrumental_novedades (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  item_id uuid not null references instrumental_items(id) on delete cascade,
  ubicacion_id uuid references instrumental_ubicaciones(id) on delete set null,
  ubicacion_destino_id uuid references instrumental_ubicaciones(id) on delete set null,
  tipo text not null check (tipo in ('Alta', 'Roto', 'Perdido', 'A reparar', 'Reparado', 'Repuesto', 'Movido', 'Faltante en conteo', 'Sobrante en conteo')),
  cantidad int not null check (cantidad > 0),
  nota text,
  registrado_por uuid references perfiles(id) on delete set null,
  registrado_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists instrumental_novedades_fecha_idx on instrumental_novedades (fecha desc);

create table if not exists instrumental_conteos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  ubicacion_id uuid references instrumental_ubicaciones(id) on delete set null,
  ubicacion_nombre text not null,
  realizado_por uuid references perfiles(id) on delete set null,
  realizado_por_nombre text,
  detalle jsonb not null,
  faltantes int not null default 0,
  sobrantes int not null default 0,
  ajustado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table instrumental_ubicaciones enable row level security;
drop policy if exists autenticados_todo on instrumental_ubicaciones;
create policy autenticados_todo on instrumental_ubicaciones for all using (puede_inventario_instrumental()) with check (puede_inventario_instrumental());

alter table instrumental_items enable row level security;
drop policy if exists autenticados_todo on instrumental_items;
create policy autenticados_todo on instrumental_items for all using (puede_inventario_instrumental()) with check (puede_inventario_instrumental());

alter table instrumental_cantidades enable row level security;
drop policy if exists autenticados_todo on instrumental_cantidades;
create policy autenticados_todo on instrumental_cantidades for all using (puede_inventario_instrumental()) with check (puede_inventario_instrumental());

alter table instrumental_novedades enable row level security;
drop policy if exists autenticados_todo on instrumental_novedades;
create policy autenticados_todo on instrumental_novedades for all using (puede_inventario_instrumental()) with check (puede_inventario_instrumental());

alter table instrumental_conteos enable row level security;
drop policy if exists autenticados_todo on instrumental_conteos;
create policy autenticados_todo on instrumental_conteos for all using (puede_inventario_instrumental()) with check (puede_inventario_instrumental());
