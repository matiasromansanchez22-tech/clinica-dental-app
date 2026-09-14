-- Migración 091: motivo de No asistió / Reprogramar / Cancelar, en General
-- y Ortodoncia — para que quede un registro de por qué no se cumplió el
-- turno tal como estaba agendado (distinto de "observaciones", que es
-- para qué viene el paciente).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table turnos_general add column if not exists motivo text;
alter table turnos_ortodoncia add column if not exists motivo text;
