-- Migración 113: dos campos nuevos para Ortodoncia al marcar qué se hizo
-- en Agenda.
--
-- 1) Nota para el próximo turno — texto libre, aparece en la nube y queda
--    como observación del cobro para no perderla.
-- 2) Cargo extra — descripción + monto libres (ej. "Estudio radiográfico"),
--    se suma al importe del Control/Consulta, igual que el bracket pero
--    para cualquier otro motivo.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists nota_proximo_turno text,
  add column if not exists cargo_extra_descripcion text,
  add column if not exists cargo_extra_monto numeric;
