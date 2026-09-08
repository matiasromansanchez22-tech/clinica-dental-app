-- Migración 081: permite que un profesional tenga un % de honorarios
-- distinto según la especialidad de la prestación (ej. Catalina cobra 35%
-- en Prótesis Fija pero 50% en Periodoncia), en vez de un único % fijo
-- para todo lo que hace.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists honorarios_especialidad (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references profesionales(id) on delete cascade,
  especialidad text not null,
  porcentaje_copago numeric not null,
  created_at timestamptz not null default now(),
  unique (profesional_id, especialidad)
);

alter table honorarios_especialidad enable row level security;
drop policy if exists honorarios_especialidad_duena on honorarios_especialidad;
create policy honorarios_especialidad_duena on honorarios_especialidad for all using (es_duena()) with check (es_duena());
