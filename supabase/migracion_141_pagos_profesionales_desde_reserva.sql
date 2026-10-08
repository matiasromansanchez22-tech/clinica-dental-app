-- Migración 141: pagos a profesionales que se pagan con la RESERVA de
-- Consultorio (por ejemplo, cuando en la caja no alcanza el efectivo y se
-- completa con plata de la reserva).
--
-- 1) pagos_profesionales.desde_reserva: marca esos pagos. No cuentan en lo
--    limpio del mes, balances ni cierres (igual que los gastos que salen de
--    la reserva), pero sí cuentan como "ya pagado" en Producción y
--    liquidación.
-- 2) movimientos_personales.pago_profesional_id: ata el descuento de la
--    reserva (Consultorio) al pago, para borrarlos juntos si hay un error.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pagos_profesionales
  add column if not exists desde_reserva boolean not null default false;

alter table movimientos_personales
  add column if not exists pago_profesional_id uuid references pagos_profesionales(id);
