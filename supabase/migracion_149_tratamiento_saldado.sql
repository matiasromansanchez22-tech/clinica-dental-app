-- Migración 149: además de "Liquidado ✓", un cobro puede quedar como "Tratamiento
-- saldado ✓": el paciente pagó todo el tratamiento y a la profesional ya se le pagó
-- el total. Es una marca más del mismo pago (cobros_liquidados), no cambia cuentas.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table cobros_liquidados
  add column if not exists tratamiento_saldado boolean not null default false;
