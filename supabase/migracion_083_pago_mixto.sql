-- Migración 083: permite cargar un cobro pagado con más de un medio de
-- pago a la vez (ej. una parte en efectivo y otra por transferencia) —
-- antes cada cobro solo podía tener un único medio de pago, lo que hacía
-- que el Cierre Diario/Turno no coincidiera con la plata real en caja
-- cuando un paciente pagaba mixto.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_general
  add column if not exists desglose_pago jsonb;

-- "Mixto" se guarda en medio_pago cuando el cobro tiene desglose_pago
-- cargado, para que las pantallas viejas que todavía miran ese campo
-- directo (sin desglosar) muestren algo con sentido en vez de un valor
-- inválido.
alter table caja_general drop constraint if exists caja_general_medio_pago_check;
alter table caja_general
  add constraint caja_general_medio_pago_check
  check (medio_pago in ('Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago', 'QR', 'Mixto'));
