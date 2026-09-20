-- Migración 105: lista de súper de la Casa.
--
-- Igual que la de Catalina (migración 104), pero para el inventario
-- general de la Casa — se arma antes de ir a comprar, se va tildando en
-- el momento y al tildar suma la cantidad al inventario (casa_items) y
-- saca el producto de la lista.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists casa_lista_compras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros'
    check (categoria in ('Alimentos', 'Limpieza', 'Higiene y perfumería', 'Electrodomésticos', 'Herramientas', 'Otros')),
  ubicacion_id uuid references casa_ubicaciones(id) on delete set null,
  cantidad numeric not null default 1,
  unidad text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table casa_lista_compras enable row level security;
drop policy if exists duena_todo on casa_lista_compras;
create policy duena_todo on casa_lista_compras for all using (es_duena()) with check (es_duena());
