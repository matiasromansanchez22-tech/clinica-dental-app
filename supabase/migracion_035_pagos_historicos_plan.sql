-- Migración 035: pagos históricos de un plan de financiación (pagos hechos
-- antes de usar esta app, o por fuera de Caja) que descuentan del saldo del
-- plan SIN sumarse a Caja, Balance ni Cierre Diario.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists planes_pagos_historicos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes_financiacion(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists planes_pagos_historicos_plan_idx on planes_pagos_historicos (plan_id);

alter table planes_pagos_historicos enable row level security;
drop policy if exists autenticados_todo on planes_pagos_historicos;
create policy autenticados_todo on planes_pagos_historicos for all using (auth.uid() is not null) with check (auth.uid() is not null);
