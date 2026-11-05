-- Migración 189: lista de insumos para comprar (Stock de Insumos).
--
-- Cualquiera del equipo (Dueñas, Secretarias, Laboratorio) anota lo que hay que comprar; las dueñas reciben un aviso.
-- Cuando se compra se marca como comprado (queda el historial de quién lo pidió y cuándo).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists stock_lista_compras (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid references stock_insumos(id) on delete set null,
  nombre text not null,
  cantidad numeric not null default 1 check (cantidad > 0),
  notas text,
  urgente boolean not null default false,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Comprado')),
  pedido_por uuid references perfiles(id) on delete set null,
  pedido_por_nombre text,
  comprado_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stock_lista_compras_estado_idx on stock_lista_compras (estado);

alter table stock_lista_compras enable row level security;
drop policy if exists autenticados_todo on stock_lista_compras;
create policy autenticados_todo on stock_lista_compras for all using (es_staff()) with check (es_staff());
