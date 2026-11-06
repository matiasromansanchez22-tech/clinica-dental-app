-- Migración 194: lista de pagos planificados (pantalla "Planificar pagos").
--
-- Es una lista de trabajo de las Dueñas: se cargan los gastos que hay que pagar, se ve el total contra lo disponible en la
-- reserva y, con un botón, se registran todos como gastos de una vez. Al registrarse, cada fila se borra de esta lista
-- (el gasto queda en Gastos, y si sale de la reserva, también descuenta de Consultorio).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists pagos_planificados (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  categoria text not null,
  monto numeric not null check (monto > 0),
  medio_pago text not null default 'Transferencia',
  fecha date,
  desde_reserva boolean not null default true,
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table pagos_planificados enable row level security;
drop policy if exists duena_todo on pagos_planificados;
create policy duena_todo on pagos_planificados for all using (es_duena()) with check (es_duena());
