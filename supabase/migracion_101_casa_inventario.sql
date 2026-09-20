-- Migración 101: inventario privado de la casa (Matías y Marianela).
--
-- No tiene nada que ver con la clínica — es solo para llevar un control
-- de qué hay en la casa (heladera, freezer, alacena, limpieza, etc.),
-- aprovechando el mismo sistema de login. Solo lo ve la Dueña (los dos
-- roles "Duena" son justamente Matías y Marianela, nadie más).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists casa_ubicaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
insert into casa_ubicaciones (nombre, orden) values
  ('Heladera', 1),
  ('Freezer', 2),
  ('Alacena', 3),
  ('Limpieza', 4),
  ('Baño', 5),
  ('Living/Comedor', 6),
  ('Depósito/Garage', 7),
  ('Otro', 8)
on conflict (nombre) do nothing;

create table if not exists casa_items (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros'
    check (categoria in ('Alimentos', 'Limpieza', 'Higiene y perfumería', 'Electrodomésticos', 'Herramientas', 'Otros')),
  ubicacion_id uuid references casa_ubicaciones(id) on delete set null,
  cantidad numeric not null default 1,
  unidad text,
  fecha_vencimiento date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table casa_ubicaciones enable row level security;
drop policy if exists duena_todo on casa_ubicaciones;
create policy duena_todo on casa_ubicaciones for all using (es_duena()) with check (es_duena());

alter table casa_items enable row level security;
drop policy if exists duena_todo on casa_items;
create policy duena_todo on casa_items for all using (es_duena()) with check (es_duena());
