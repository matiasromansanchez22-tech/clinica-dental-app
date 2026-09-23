-- Migración 111: permite marcar "se despegó un bracket" junto con el
-- Control, desde Agenda — mismo dato que ya existía en el cobro de
-- Ortodoncia (bracket_reposicion / cantidad_brackets), ahora también acá
-- para que viaje pre-cargado hasta Caja y se cobre todo junto.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table prestaciones_realizadas_agenda
  add column if not exists bracket_reposicion text,
  add column if not exists cantidad_brackets integer;
