-- Migración 084: agrega "Insumos descartables" como un sector más en
-- Stock (guantes, barbijos, algodón, jeringas, etc. — cosas que se usan en
-- cualquier tratamiento, no de un área puntual), para poder cargarlos y
-- controlarlos separados del resto.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table stock_insumos drop constraint if exists stock_insumos_sector_check;
alter table stock_insumos
  add constraint stock_insumos_sector_check
  check (sector in ('Odontología General', 'Tratamiento de Conducto', 'Ortodoncia', 'Insumos descartables', 'Otros'));
