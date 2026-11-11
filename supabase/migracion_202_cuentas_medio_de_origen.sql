-- Migración 202: en "Pasé plata entre cuentas", indicar de qué medio de pago venía la plata.
--
-- Ejemplo: $50.000 que entraron como Débito y se pasaron a la cuenta de Galicia. En el control de Cuentas contra el Balance Mensual,
-- esos $50.000 dejan de figurar como Débito y pasan a figurar como Transferencia. Es solo cómo se muestra el desglose por medio:
-- no cambia los cobros, ni ningún balance, ni el total que se compara con el banco.
--
-- medio_origen es opcional: las transferencias entre cuentas que no lo indican siguen igual.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table movimientos_cuentas add column if not exists medio_origen text;

alter table movimientos_cuentas drop constraint if exists movimientos_cuentas_medio_origen_valido;
alter table movimientos_cuentas add constraint movimientos_cuentas_medio_origen_valido
  check (medio_origen is null or (medio_origen in ('Débito', 'Crédito', 'Mercado Pago', 'QR') and tipo = 'Transferencia'));
