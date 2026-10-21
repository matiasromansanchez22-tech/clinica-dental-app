-- Migración 164: agrega "Es ortopedia (otro tratamiento)" a las opciones de revisión del Control de instalaciones.
--
-- Los pacientes de ortopedia tienen otro tratamiento y otro precio que ortodoncia, así que no corresponden al control de
-- instalaciones (precio de lista de brackets). Las dueñas los marcan con esta opción y quedan afuera del control.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table revision_instalaciones_ortodoncia drop constraint if exists revision_instalaciones_ortodoncia_resultado_check;
alter table revision_instalaciones_ortodoncia add constraint revision_instalaciones_ortodoncia_resultado_check
  check (resultado in (
    'Ya estaba instalado antes de la app', 'No se instaló', 'Pago registrado afuera', 'Descuento autorizado',
    'Es ortopedia (otro tratamiento)'
  ));
