-- Migración 066: Registro de entrada/salida del personal (secretarios,
-- principalmente) para saber cuántas horas hizo cada uno y liquidarles a
-- fin de mes. Cada uno marca su propio horario; la Dueña ve y puede
-- corregir el de todos, y define el valor hora de cada persona.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table perfiles add column if not exists valor_hora numeric;

create table if not exists registros_horario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id),
  fecha date not null default current_date,
  hora_entrada time,
  hora_salida time,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists registros_horario_usuario_fecha_idx on registros_horario (usuario_id, fecha desc);

alter table registros_horario enable row level security;
drop policy if exists horario_propio_o_duena on registros_horario;
create policy horario_propio_o_duena on registros_horario for all
  using (es_duena() or usuario_id = auth.uid())
  with check (es_duena() or usuario_id = auth.uid());
