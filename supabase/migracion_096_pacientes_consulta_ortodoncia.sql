-- Migración 096: distinguir pacientes que vinieron solo a una consulta de
-- ortodoncia de los que ya están en tratamiento. Se agrega "Consulta" como
-- estado posible — si después el paciente arranca el tratamiento (se le
-- carga un turno de "Instalación superior/inferior"), el sistema lo pasa
-- solo a "Activo" sin que haya que cargarlo de nuevo.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes_ortodoncia drop constraint if exists pacientes_ortodoncia_estado_paciente_check;
alter table pacientes_ortodoncia add constraint pacientes_ortodoncia_estado_paciente_check
  check (estado_paciente in ('Consulta', 'Activo', 'Inactivo', 'Finalizado', 'Abandonó'));
