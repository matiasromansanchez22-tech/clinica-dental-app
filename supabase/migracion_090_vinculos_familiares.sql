-- Migración 090: vínculos familiares entre pacientes (General) — permite
-- conectar a un paciente con otro ya cargado (ej. madre e hija) y ver el
-- vínculo desde la ficha de cualquiera de los dos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists vinculos_familiares (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  paciente_vinculado_id uuid not null references pacientes(id) on delete cascade,
  -- La relación describe qué es "paciente_vinculado_id" para "paciente_id"
  -- (ej. si paciente_id = Ana y paciente_vinculado_id = Juana con
  -- relacion = 'Madre', significa "Juana es la Madre de Ana").
  relacion text not null check (relacion in ('Madre', 'Padre', 'Hijo/a', 'Hermano/a', 'Pareja', 'Otro')),
  created_at timestamptz not null default now(),
  constraint vinculo_no_auto_referencia check (paciente_id <> paciente_vinculado_id),
  unique (paciente_id, paciente_vinculado_id)
);

create index if not exists vinculos_familiares_paciente_idx on vinculos_familiares (paciente_id);
create index if not exists vinculos_familiares_vinculado_idx on vinculos_familiares (paciente_vinculado_id);

alter table vinculos_familiares enable row level security;
drop policy if exists autenticados_todo on vinculos_familiares;
create policy autenticados_todo on vinculos_familiares
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
