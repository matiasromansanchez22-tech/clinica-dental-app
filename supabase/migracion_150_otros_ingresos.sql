-- Migración 150: "Otros ingresos" — plata que entra a la clínica y no viene de un
-- paciente ni de ASOR (por ejemplo, lo que paga Scanner, el centro de diagnóstico de
-- las panorámicas). Suma al ingreso del mes en Balance Mensual, Balance Anual,
-- Tablero y Cierre de Mes; NO toca la reserva de Consultorio (ese balance es lo que
-- después se deposita en la reserva, así que sumarlo en los dos lugares lo contaría
-- dos veces) ni las cajas del día.
--
-- Lo cargan y ven las Dueñas y la Contadora.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists otros_ingresos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  concepto text not null,
  monto numeric not null check (monto > 0),
  medio_pago text not null default 'Transferencia',
  observaciones text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists otros_ingresos_fecha_idx on otros_ingresos (fecha);

alter table otros_ingresos enable row level security;
drop policy if exists otros_ingresos_duena_y_contador on otros_ingresos;
create policy otros_ingresos_duena_y_contador on otros_ingresos for all
  using (es_duena() or es_contador()) with check (es_duena() or es_contador());
