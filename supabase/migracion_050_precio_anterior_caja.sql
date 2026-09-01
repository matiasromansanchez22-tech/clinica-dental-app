-- Migración 050: marca de "precio anterior" en caja_general — para los
-- cobros de la transición donde se cobra con el precio viejo del catálogo
-- (paciente ya acordado antes del aumento). Esos cobros se liquidan al
-- profesional por lo efectivamente cobrado, no por el valor de catálogo
-- actual de la prestación.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_general add column if not exists precio_anterior boolean not null default false;
