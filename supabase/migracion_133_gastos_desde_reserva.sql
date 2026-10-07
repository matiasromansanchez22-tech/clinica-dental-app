-- Migración 133: marca "pagado con la reserva del Consultorio" en cada gasto.
--
-- Los gastos con esta marca ya se descontaron de la reserva de Consultorio al
-- cargarlos, así que NO cuentan como gasto del mes en el Balance Mensual, el
-- Balance Anual ni el Cierre de Mes (si no, se descontaban dos veces), ni en
-- "Lo que queda limpio" ni en el Cierre Diario.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table gastos add column if not exists desde_reserva boolean not null default false;

-- Marca los gastos que ya se descontaron de la reserva de Consultorio
update gastos set desde_reserva = true
where id in (
  select gasto_id from movimientos_personales
  where gasto_id is not null and tipo = 'Egreso' and panel = 'Consultorio'
);
