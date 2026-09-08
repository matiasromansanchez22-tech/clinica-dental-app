-- Migración 074: vincula cada trabajo de laboratorio con su prestación
-- del catálogo, para poder calcular cuánto cobramos por ese trabajo vs.
-- cuánto le pagamos al mecánico (el margen real de cada uno).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table laboratorio_trabajos
  add column if not exists id_catalogo text references catalogo_prestaciones(id);
