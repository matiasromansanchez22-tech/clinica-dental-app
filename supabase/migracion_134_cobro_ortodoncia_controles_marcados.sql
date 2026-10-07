-- Migración 134: el cobro de Ortodoncia recuerda qué meses completó en la
-- grilla de Controles, para poder desmarcarlos si ese cobro se borra.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_ortodoncia add column if not exists controles_marcados jsonb;
