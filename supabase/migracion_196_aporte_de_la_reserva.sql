-- Migración 196: "aporte de la reserva" en los balances.
--
-- Cuando una cuenta se paga con plata de la reserva pero se quiere que figure en el Balance Mensual sin restarle al mes
-- (ej. la cuota del crédito del auto), se cargan dos registros que se compensan: un gasto y un "otro ingreso" por el mismo
-- monto. Estas dos marcas permiten que ese "ingreso" NO se cuente como plata nueva en el Tablero Mensual, Metas y Balance Anual.
--   otros_ingresos.es_aporte_reserva  → el ingreso es un aporte de la reserva (no es plata que entró de afuera)
--   gastos.cubierto_por_reserva       → el gasto está cubierto por ese aporte
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table otros_ingresos add column if not exists es_aporte_reserva boolean not null default false;
alter table gastos add column if not exists cubierto_por_reserva boolean not null default false;

-- Los dos registros de la cuota del crédito del auto de noviembre 2026 que ya están cargados.
update otros_ingresos set es_aporte_reserva = true
where concepto = 'Aporte de la reserva — cuota crédito del auto' and fecha = '2026-11-06';

update gastos set cubierto_por_reserva = true
where descripcion = 'Cuota crédito del auto' and fecha = '2026-11-06';
