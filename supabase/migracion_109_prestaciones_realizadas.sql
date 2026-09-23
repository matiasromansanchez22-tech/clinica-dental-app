-- Migración 109: lo que el profesional marca como "hecho" en la Agenda.
--
-- Sirve tanto para pacientes con plan/presupuesto (se tilda un paso del
-- plan) como sin plan (se elige una prestación suelta del catálogo), y
-- también para Ortodoncia (se confirma el concepto del turno). Caja lo usa
-- para venir pre-completado en vez de arrancar de cero — y cuando se cobra,
-- queda marcado "cobrado" para no volver a aparecer como pendiente.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists prestaciones_realizadas_agenda (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  profesional_id uuid references profesionales(id),
  turno_general_id uuid references turnos_general(id) on delete set null,
  turno_ortodoncia_id uuid references turnos_ortodoncia(id) on delete set null,
  paciente_id uuid references pacientes(id) on delete cascade,
  paciente_ortodoncia_id uuid references pacientes_ortodoncia(id) on delete cascade,
  presupuesto_id uuid references presupuestos(id) on delete set null,
  catalogo_id text references catalogo_prestaciones(id),
  prestacion text not null,
  cantidad integer not null default 1,
  cobrado boolean not null default false,
  caja_general_id uuid references caja_general(id) on delete set null,
  caja_ortodoncia_id uuid references caja_ortodoncia(id) on delete set null,
  usuario_id uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_prestaciones_realizadas_paciente on prestaciones_realizadas_agenda(paciente_id) where cobrado = false;
create index if not exists idx_prestaciones_realizadas_paciente_orto on prestaciones_realizadas_agenda(paciente_ortodoncia_id) where cobrado = false;

alter table prestaciones_realizadas_agenda enable row level security;
drop policy if exists staff_todo on prestaciones_realizadas_agenda;
create policy staff_todo on prestaciones_realizadas_agenda for all using (es_staff()) with check (es_staff());
