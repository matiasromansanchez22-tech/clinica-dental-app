-- Migración 107: meta de consultas por profesional (circuito de ventas).
--
-- Permite fijar, mes a mes, cuántas consultas nuevas se le asignan a cada
-- profesional, para después comparar contra cuántas de esas realmente
-- terminaron en tratamiento ("vendió") y decidir si el mes que viene se
-- le suman más consultas o no.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists metas_consultas_profesional (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id) on delete cascade,
  anio int not null,
  mes int not null,
  consultas_objetivo int not null default 0,
  updated_at timestamptz not null default now(),
  unique (profesional_id, anio, mes)
);

alter table metas_consultas_profesional enable row level security;
drop policy if exists duena_todo on metas_consultas_profesional;
create policy duena_todo on metas_consultas_profesional for all using (es_duena()) with check (es_duena());
