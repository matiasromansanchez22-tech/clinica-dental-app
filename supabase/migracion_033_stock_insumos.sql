-- Migración 033: control de stock de insumos por rodante.
--
-- Permite llevar un control de cuánto insumo hay cargado en cada "rodante"
-- (carrito móvil de insumos), para saber qué falta reponer en cada uno.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists stock_rodantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
insert into stock_rodantes (nombre, orden) values
  ('Rodante 1', 1), ('Rodante 2', 2), ('Rodante 3', 3)
on conflict (nombre) do nothing;

create table if not exists stock_insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  sector text not null default 'Odontología General'
    check (sector in ('Odontología General', 'Tratamiento de Conducto', 'Ortodoncia', 'Otros')),
  created_at timestamptz not null default now()
);

create table if not exists stock_cantidades (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references stock_insumos(id) on delete cascade,
  rodante_id uuid not null references stock_rodantes(id) on delete cascade,
  cantidad numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (insumo_id, rodante_id)
);

alter table stock_rodantes enable row level security;
drop policy if exists autenticados_todo on stock_rodantes;
create policy autenticados_todo on stock_rodantes for all using (es_staff()) with check (es_staff());

alter table stock_insumos enable row level security;
drop policy if exists autenticados_todo on stock_insumos;
create policy autenticados_todo on stock_insumos for all using (es_staff()) with check (es_staff());

alter table stock_cantidades enable row level security;
drop policy if exists autenticados_todo on stock_cantidades;
create policy autenticados_todo on stock_cantidades for all using (es_staff()) with check (es_staff());
