-- Migración 127: el Contador puede VER (solo lectura) los horarios del
-- personal y su valor hora, para poder liquidar sueldos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_leer on registros_horario;
create policy contador_leer on registros_horario for select using (es_contador());

drop policy if exists contador_leer on perfiles;
create policy contador_leer on perfiles for select using (es_contador());
