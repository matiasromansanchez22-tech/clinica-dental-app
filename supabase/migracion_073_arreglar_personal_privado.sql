-- Migración 073: arregla un error de la migración 072. La restricción a
-- nivel de base de datos impedía que uno de los dos dueños cargara un
-- movimiento "para" el otro (por ejemplo, vos registrando el sueldo de
-- Marianela) — ni siquiera dejaba crear la fila.
--
-- La privacidad entre los dos ("cada uno ve solo lo suyo" en la
-- pantalla) se sigue cumpliendo iguales, pero ahora se filtra desde la
-- propia app en vez de bloquear a nivel de base de datos, que era
-- demasiado estricto y rompía la carga de sueldos cruzada.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists consultorio_duena on movimientos_personales;
drop policy if exists personal_propio on movimientos_personales;

drop policy if exists duena_todo on movimientos_personales;
create policy duena_todo on movimientos_personales for all
  using (es_duena())
  with check (es_duena());
