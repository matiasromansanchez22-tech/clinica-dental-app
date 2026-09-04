-- Migración 065: Cuenta personal (Efectivo/Banco) separada de la caja de
-- la clínica — para cargar el saldo disponible, registrar el sueldo que
-- se pagan Matías y Marianela desde el consultorio, y llevar registro de
-- los gastos de casa pagados con ese sueldo. Solo para la Dueña (no lo ve
-- el resto del personal ni el Contador).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists movimientos_personales (
  id uuid primary key default gen_random_uuid(),
  cuenta text not null check (cuenta in ('Efectivo', 'Banco')),
  tipo text not null check (tipo in ('Ingreso', 'Egreso')),
  categoria text not null,
  monto numeric not null,
  fecha date not null default current_date,
  descripcion text,
  gasto_id uuid references gastos(id),
  created_at timestamptz not null default now()
);
create index if not exists movimientos_personales_fecha_idx on movimientos_personales (fecha desc);

alter table movimientos_personales enable row level security;
drop policy if exists duena_todo on movimientos_personales;
create policy duena_todo on movimientos_personales for all using (es_duena()) with check (es_duena());
