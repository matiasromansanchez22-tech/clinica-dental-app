-- Migración 114: odontograma por paciente (Sistema General).
--
-- Guarda el estado ACTUAL de cada diente/cara — no un historial propio: cada
-- cambio también genera una entrada en historial_clinico_general_entradas
-- (esa sí es la que queda como registro histórico). Por eso alcanza con una
-- fila por (paciente, pieza, cara) que se pisa con upsert.
--
-- pieza: numeración FDI de dos dígitos ("11".."48").
-- cara: "vestibular" | "mesial" | "oclusal" | "distal" | "palatino" | "general"
--   ("general" = todo el diente: Ausente, Corona, Conducto, Implante, A extraer)
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists odontograma_estado (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  pieza text not null,
  cara text not null,
  estado text not null,
  profesional_id uuid references profesionales(id) on delete set null,
  fecha date not null,
  updated_at timestamptz not null default now(),
  unique (paciente_id, pieza, cara)
);

create index if not exists odontograma_estado_paciente_idx on odontograma_estado(paciente_id);

alter table odontograma_estado enable row level security;
drop policy if exists staff_todo on odontograma_estado;
create policy staff_todo on odontograma_estado for all using (es_staff()) with check (es_staff());
