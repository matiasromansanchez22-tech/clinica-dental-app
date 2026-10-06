-- Migración 131: contador de billetes en el Cierre de Turno.
--
-- Guarda, junto con cada cierre de turno (General y Ortodoncia), cuánto
-- efectivo contó la secretaria y el detalle de billetes que contó.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cierres_turno
  add column if not exists efectivo_contado numeric,
  add column if not exists conteo_billetes jsonb;

alter table cierres_turno_ortodoncia
  add column if not exists efectivo_contado numeric,
  add column if not exists conteo_billetes jsonb;
