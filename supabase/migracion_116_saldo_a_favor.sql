-- Migración 116: saldo a favor del paciente.
--
-- Ledger simple (como planes_pagos_historicos): cada fila es un movimiento,
-- positivo cuando se le carga saldo a favor a mano, negativo cuando se
-- aplica a un cobro. El saldo actual es la suma de sus movimientos — no
-- hace falta guardar un total aparte.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists saldos_a_favor (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes(id) on delete cascade,
  paciente_ortodoncia_id uuid references pacientes_ortodoncia(id) on delete cascade,
  monto numeric not null,
  motivo text,
  caja_general_id uuid references caja_general(id) on delete set null,
  caja_ortodoncia_id uuid references caja_ortodoncia(id) on delete set null,
  usuario_id uuid references perfiles(id),
  fecha date not null,
  created_at timestamptz not null default now(),
  constraint saldos_a_favor_un_paciente check (
    (paciente_id is not null and paciente_ortodoncia_id is null) or
    (paciente_id is null and paciente_ortodoncia_id is not null)
  )
);

create index if not exists saldos_a_favor_paciente_idx on saldos_a_favor(paciente_id);
create index if not exists saldos_a_favor_paciente_orto_idx on saldos_a_favor(paciente_ortodoncia_id);

alter table saldos_a_favor enable row level security;
drop policy if exists staff_todo on saldos_a_favor;
create policy staff_todo on saldos_a_favor for all using (es_staff()) with check (es_staff());
