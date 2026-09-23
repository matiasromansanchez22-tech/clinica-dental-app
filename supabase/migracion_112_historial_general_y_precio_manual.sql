-- Migración 112: dos cosas para Sistema General.
--
-- 1) Historial clínico real para Odontología General — mismo patrón que ya
--    existe para Ortodoncia (notas con fecha y profesional), pero en tabla
--    aparte porque apunta a "pacientes" (Sistema General), no a
--    "pacientes_ortodoncia".
--
-- 2) Precio distinto al marcar una prestación suelta (sin plan) desde
--    Agenda — si se completa, reemplaza el precio de catálogo cuando se
--    pre-carga en Caja.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists historial_clinico_general_entradas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  fecha date not null,
  profesional_id uuid references profesionales(id),
  nota text not null,
  created_at timestamptz not null default now()
);

alter table historial_clinico_general_entradas enable row level security;
drop policy if exists staff_todo on historial_clinico_general_entradas;
create policy staff_todo on historial_clinico_general_entradas for all using (es_staff()) with check (es_staff());

alter table prestaciones_realizadas_agenda
  add column if not exists precio_manual numeric;
