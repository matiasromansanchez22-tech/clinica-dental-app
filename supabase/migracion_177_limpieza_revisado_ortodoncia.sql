-- Migración 177: marca de "revisado" en la Limpieza de pacientes de Ortodoncia.
--
-- En Ortodoncia → Limpieza de pacientes, la dueña puede marcar que un paciente "sigue en tratamiento".
-- Esa marca guarda la fecha y hace que el paciente no vuelva a aparecer en la lista durante 90 días.
-- No cambia el estado del paciente (sigue como Activo).
--
-- Para DESHACER: alter table pacientes_ortodoncia drop column limpieza_revisado_en;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes_ortodoncia add column if not exists limpieza_revisado_en date;
