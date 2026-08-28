-- Migración 037: remitos de ASOR (lo que reporta el intermediario como
-- pendiente de liquidar, por obra social/plan/período/remito) — distinto de
-- facturacion_obras_sociales (que es por paciente/prestación, generado solo
-- desde Caja) y de pagos_asor (las transferencias ya cobradas).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists remitos_asor (
  id uuid primary key default gen_random_uuid(),
  obra_social text not null,
  plan text,
  periodo text not null,
  numero_remito text not null,
  total_presupuestado numeric not null default 0,
  total_prestaciones numeric not null default 0,
  descuentos numeric not null default 0,
  pendiente_liquidar numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists remitos_asor_obra_social_idx on remitos_asor (obra_social);

alter table remitos_asor enable row level security;
drop policy if exists autenticados_todo on remitos_asor;
create policy autenticados_todo on remitos_asor for all using (es_staff()) with check (es_staff());
