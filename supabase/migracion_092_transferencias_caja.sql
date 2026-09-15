-- Migración 092: transferencias de efectivo entre Caja General y Caja
-- Ortodoncia (cuando a una le falta plata para cubrir un pago y se cubre
-- con la de la otra). Se guarda aparte de "gastos" a propósito: es un
-- movimiento interno de la clínica, no un gasto real, así que no debe
-- sumar a los egresos de Balance Mensual ni de Cierre Diario.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists transferencias_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  monto numeric not null check (monto > 0),
  origen text not null check (origen in ('General', 'Ortodoncia')),
  destino text not null check (destino in ('General', 'Ortodoncia')),
  medio_pago text not null default 'Efectivo',
  observaciones text,
  usuario_id uuid references perfiles(id),
  created_at timestamptz not null default now(),
  constraint transferencia_origen_destino_distintos check (origen <> destino)
);

create index if not exists transferencias_caja_fecha_idx on transferencias_caja (fecha);

alter table transferencias_caja enable row level security;
drop policy if exists autenticados_todo on transferencias_caja;
create policy autenticados_todo on transferencias_caja
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
