-- Migración 103: stock de comida de Catalina (lo que se le va comprando).
--
-- Complementa el registro de alimentos probados (migración 102) — esto es
-- para llevar cantidad de lo que tienen guardado (potitos, fórmula,
-- papillas, etc.), separado del inventario general de la Casa.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists catalina_stock (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros'
    check (categoria in ('Frutas', 'Verduras', 'Cereales y legumbres', 'Lácteos', 'Carnes y pescado', 'Huevo', 'Otros')),
  cantidad numeric not null default 1,
  unidad text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table catalina_stock enable row level security;
drop policy if exists duena_todo on catalina_stock;
create policy duena_todo on catalina_stock for all using (es_duena()) with check (es_duena());
