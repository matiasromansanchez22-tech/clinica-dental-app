-- Cierre de Mes: el balance ahora entra a la reserva de Consultorio repartido en dos movimientos
-- (lo que es efectivo va a la cuenta Efectivo, el resto a la cuenta Banco).
-- Se guarda el id del segundo movimiento para poder sacarlo si se reabre el mes.
alter table cierres_mes_verificados
  add column if not exists movimiento_consultorio_efectivo_id uuid references movimientos_personales(id) on delete set null;
