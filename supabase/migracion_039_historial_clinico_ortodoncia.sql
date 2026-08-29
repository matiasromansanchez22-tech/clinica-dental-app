-- Migración 039: datos fijos de ficha médica + historial clínico (lista de
-- controles con fecha y nota libre) para pacientes de Ortodoncia. Reemplaza
-- los Word sueltos por paciente que se usaban hasta ahora.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes_ortodoncia add column if not exists enfermedades text;
alter table pacientes_ortodoncia add column if not exists patologias text;
alter table pacientes_ortodoncia add column if not exists alergias text;
alter table pacientes_ortodoncia add column if not exists medicacion text;
alter table pacientes_ortodoncia add column if not exists atm text;

create table if not exists historial_clinico_entradas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes_ortodoncia(id) on delete cascade,
  fecha date not null,
  profesional_id uuid references profesionales(id),
  nota text not null,
  created_at timestamptz not null default now()
);
create index if not exists historial_clinico_entradas_paciente_idx on historial_clinico_entradas (paciente_id, fecha desc);

alter table historial_clinico_entradas enable row level security;
drop policy if exists autenticados_todo on historial_clinico_entradas;
create policy autenticados_todo on historial_clinico_entradas for all using (es_staff()) with check (es_staff());
