-- Migración 036: pagos de ASOR (el intermediario que transfiere lo que
-- pagan las obras sociales) y conciliación contra las fichas de
-- facturación ya cargadas.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists pagos_asor (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  monto numeric not null,
  observaciones text,
  created_at timestamptz not null default now()
);

alter table facturacion_obras_sociales add column if not exists pago_asor_id uuid references pagos_asor(id);
create index if not exists facturacion_obras_sociales_pago_asor_idx on facturacion_obras_sociales (pago_asor_id);

alter table pagos_asor enable row level security;
drop policy if exists autenticados_todo on pagos_asor;
create policy autenticados_todo on pagos_asor for all using (es_staff()) with check (es_staff());
