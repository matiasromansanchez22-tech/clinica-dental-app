-- Migración 052: valor de cada trabajo de laboratorio, para poder
-- reflejar cuánto se le debe a cada mecánico y cotejarlo contra lo que
-- factura.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table laboratorio_trabajos add column if not exists valor numeric;
