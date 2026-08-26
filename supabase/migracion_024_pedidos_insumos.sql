-- Migración 024: Pedidos de insumos y Notas de crédito de proveedores.
--
-- Permite cargar compras de insumos a proveedores (con ítems que se suman
-- solos al total) y registrar devoluciones como notas de crédito, para
-- saber en todo momento cuánto queda a favor de cada proveedor.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists pedidos_insumos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  proveedor_id uuid not null references proveedores(id),
  items jsonb not null default '[]', -- [{ insumo, cantidad, precioUnitario }]
  total numeric not null default 0,
  medio_pago text,
  estado text not null default 'Recibido' check (estado in ('Pendiente', 'Recibido', 'Cancelado')),
  observaciones text,
  created_at timestamptz not null default now()
);

create table if not exists notas_credito_proveedores (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  proveedor_id uuid not null references proveedores(id),
  pedido_id uuid references pedidos_insumos(id),
  motivo text,
  monto numeric not null default 0,
  estado text not null default 'Disponible' check (estado in ('Disponible', 'Usada', 'Vencida')),
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists pedidos_insumos_proveedor_idx on pedidos_insumos (proveedor_id);
create index if not exists notas_credito_proveedor_idx on notas_credito_proveedores (proveedor_id);

alter table proveedores enable row level security;
drop policy if exists autenticados_todo on proveedores;
create policy autenticados_todo on proveedores for all using (es_staff()) with check (es_staff());

alter table pedidos_insumos enable row level security;
drop policy if exists autenticados_todo on pedidos_insumos;
create policy autenticados_todo on pedidos_insumos for all using (es_staff()) with check (es_staff());

alter table notas_credito_proveedores enable row level security;
drop policy if exists autenticados_todo on notas_credito_proveedores;
create policy autenticados_todo on notas_credito_proveedores for all using (es_staff()) with check (es_staff());
