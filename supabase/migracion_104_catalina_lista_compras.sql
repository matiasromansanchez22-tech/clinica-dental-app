-- Migración 104: lista de súper de Catalina.
--
-- Lista de lo que hay que comprarle — se va tildando en el momento de la
-- compra y, al tildar, suma la cantidad al stock (migración 103) y saca
-- el producto de la lista.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists catalina_lista_compras (
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

alter table catalina_lista_compras enable row level security;
drop policy if exists duena_todo on catalina_lista_compras;
create policy duena_todo on catalina_lista_compras for all using (es_duena()) with check (es_duena());
