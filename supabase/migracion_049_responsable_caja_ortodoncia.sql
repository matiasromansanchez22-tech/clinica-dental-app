-- Migración 049: agrega a caja_ortodoncia el ortodoncista responsable
-- (habitual del paciente, informativo) separado del que efectivamente
-- atendió (ortodoncista_id), igual que ya existe en caja_general.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia add column if not exists ortodoncista_responsable_id uuid references profesionales(id);
