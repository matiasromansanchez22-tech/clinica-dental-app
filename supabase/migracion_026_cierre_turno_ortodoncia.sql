-- Migración 026: Cierre de Turno para Ortodoncia (igual que en General).
--
-- Agrega la misma mecánica de "Cierre de Turno" ya usada en Odontología
-- General, pero para la Caja de Ortodoncia: cada secretario/a cierra solo
-- lo que él/ella cargó ese día.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia
  add column if not exists usuario_id uuid references auth.users(id) default auth.uid();

create table if not exists cierres_turno_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  usuario_id uuid not null references auth.users(id),
  nombre_secretaria text,
  efectivo numeric not null default 0,
  transferencia numeric not null default 0,
  debito numeric not null default 0,
  credito numeric not null default 0,
  mercado_pago numeric not null default 0,
  qr numeric not null default 0,
  total_general numeric not null default 0,
  observaciones text,
  guardado_en timestamptz not null default now(),
  unique (fecha, usuario_id)
);

create index if not exists cierres_turno_ortodoncia_fecha_idx on cierres_turno_ortodoncia (fecha);

alter table cierres_turno_ortodoncia enable row level security;
drop policy if exists autenticados_todo on cierres_turno_ortodoncia;
create policy autenticados_todo on cierres_turno_ortodoncia for all using (es_staff()) with check (es_staff());
