-- Migración 046: marca cuál es el laboratorio elegido para cada trabajo,
-- para que la Comparativa de mecánicos no sea solo referencia sino
-- también el plan de derivación decidido.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table mecanicos_precios add column if not exists preferido boolean not null default false;
