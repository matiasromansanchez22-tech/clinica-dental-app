-- Migración 128: el Contador puede VER (solo lectura) los cierres de turno
-- de cada secretaria (General y Ortodoncia), para poder revisar el Cierre
-- Diario completo.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_leer on cierres_turno;
create policy contador_leer on cierres_turno for select using (es_contador());

drop policy if exists contador_leer on cierres_turno_ortodoncia;
create policy contador_leer on cierres_turno_ortodoncia for select using (es_contador());
