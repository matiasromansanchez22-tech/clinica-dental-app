-- Migración 197: la secretaria (y el contador) pueden VER los porcentajes especiales por especialidad.
--
-- Problema: la tabla honorarios_especialidad (ej. Catalina = 50% en Periodoncia) solo la podía leer la Dueña. Cuando la secretaria
-- abría "Registrar pago a profesional", el sistema no veía la excepción y calculaba con el porcentaje general (35%) y sin el
-- resaltado amarillo. Con esta política pueden LEERLA (no modificarla): cargar o cambiar porcentajes sigue siendo solo de la Dueña.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists honorarios_especialidad_lectura_staff on honorarios_especialidad;
create policy honorarios_especialidad_lectura_staff on honorarios_especialidad for select
  using (es_caja() or es_contador());
