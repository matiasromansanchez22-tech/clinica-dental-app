-- Migración 067: separa "Cuenta Personal" en dos paneles independientes,
-- ambos con su propio saldo Efectivo/Banco:
--   - Consultorio: la plata disponible del consultorio (lo que ya estaba
--     cargado como saldo inicial pasa a ser esto).
--   - Personal: la plata de Matías y Marianela, alimentada por los
--     sueldos que se registran desde Consultorio.
--
-- "Registrar sueldo" ahora hace TRES movimientos a la vez: el Gasto
-- oficial de la clínica (como ya hacía), un Egreso en Consultorio, y un
-- Ingreso en Personal — estos dos últimos quedan vinculados entre sí para
-- poder borrarlos juntos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table movimientos_personales
  add column if not exists panel text not null default 'Consultorio'
    check (panel in ('Consultorio', 'Personal'));

alter table movimientos_personales
  add column if not exists movimiento_vinculado_id uuid references movimientos_personales(id);
