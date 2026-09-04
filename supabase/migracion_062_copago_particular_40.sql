-- Migración 062: Copago general al 40% del valor particular para todas
-- las obras sociales (decisión de Matías), sacando la regla especial que
-- tenía IAPOS para que también quede bajo esta regla general.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

update configuracion_copago_particular set porcentaje = 40 where id = 1;

delete from configuracion_copago_excepcion where obra_social = 'IAPOS';
