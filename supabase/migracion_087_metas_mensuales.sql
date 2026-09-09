-- Migración 087: Metas y Seguimiento — la Dueña puede definir, para cada
-- mes, un objetivo de ingresos, de balance (ganancia) y/o de pacientes
-- nuevos, y la app muestra cómo viene el mes en tiempo real contra esa
-- meta (con una proyección a fin de mes según el ritmo actual).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists metas_mensuales (
  id uuid primary key default gen_random_uuid(),
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  ingresos_objetivo numeric,
  balance_objetivo numeric,
  pacientes_nuevos_objetivo integer,
  observaciones text,
  usuario_id uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (anio, mes)
);

alter table metas_mensuales enable row level security;
drop policy if exists metas_mensuales_duena on metas_mensuales;
create policy metas_mensuales_duena on metas_mensuales for all using (es_duena()) with check (es_duena());
