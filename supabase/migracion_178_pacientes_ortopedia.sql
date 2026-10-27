-- Migración 178: marca de "paciente de ortopedia" en las fichas de Ortodoncia.
--
-- Hasta que exista la sección de Ortopedia, estos pacientes están cargados dentro de Ortodoncia. Con esta marca
-- se los puede identificar y dejarlos afuera de lo que es solo de ortodoncia: el seguimiento, la limpieza de
-- pacientes, Retomar, la tarjeta de fidelidad y el plan de referidos. Su agenda y su caja no cambian.
--
-- Para DESHACER: alter table pacientes_ortodoncia drop column es_ortopedia;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pacientes_ortodoncia add column if not exists es_ortopedia boolean not null default false;
