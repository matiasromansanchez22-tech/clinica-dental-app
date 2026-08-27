-- Migración 034: traspasos de Stock a rodantes + cierre semanal congelado.
--
-- Antes cada celda de la grilla de Stock se editaba suelta, sin relación
-- entre sí. Ahora completar un rodante es un "traspaso": resta del Stock y
-- suma al rodante automáticamente, y queda un registro de cada movimiento.
-- También se agrega un cierre semanal (viernes) que congela cuánto se
-- traspasó esa semana y con cuánto quedó el Stock, igual que el cierre
-- diario de caja.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table stock_rodantes add column if not exists es_deposito boolean not null default false;
update stock_rodantes set es_deposito = true where nombre = 'Stock';

create table if not exists stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  insumo_id uuid not null references stock_insumos(id) on delete cascade,
  rodante_id uuid not null references stock_rodantes(id) on delete cascade,
  cantidad numeric not null,
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movimientos_fecha_idx on stock_movimientos (fecha);

create table if not exists stock_cierres_semanales (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null,
  semana_fin date not null,
  detalle jsonb not null,
  nombre_duena text,
  aprobado_en timestamptz not null default now(),
  observaciones text,
  unique (semana_inicio, semana_fin)
);

alter table stock_movimientos enable row level security;
drop policy if exists autenticados_todo on stock_movimientos;
create policy autenticados_todo on stock_movimientos for all using (es_staff()) with check (es_staff());

alter table stock_cierres_semanales enable row level security;
drop policy if exists autenticados_todo on stock_cierres_semanales;
create policy autenticados_todo on stock_cierres_semanales for all using (es_staff()) with check (es_staff());
