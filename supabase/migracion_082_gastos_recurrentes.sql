-- Migración 082: "Gastos Recurrentes" — un listado propio (no dentro de
-- Gerencial, solo visible para Dueña) con todos los gastos fijos y
-- variables de la clínica, para tildarlos como pagados con un solo botón
-- en vez de cargar el formulario completo de Gastos cada vez.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists gastos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null,
  tipo text not null default 'Fijo' check (tipo in ('Fijo', 'Variable')),
  monto_sugerido numeric,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gastos_recurrentes_activo_idx on gastos_recurrentes (activo);

alter table gastos_recurrentes enable row level security;
drop policy if exists gastos_recurrentes_duena on gastos_recurrentes;
create policy gastos_recurrentes_duena on gastos_recurrentes for all using (es_duena()) with check (es_duena());
