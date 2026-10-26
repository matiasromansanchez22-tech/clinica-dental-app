-- Migración 175: las condiciones del plan de referidos se pueden leer sin iniciar sesión.
--
-- La página pública del plan (la que se abre al escanear el QR del cartel) muestra los montos y las
-- condiciones. Para que siempre coincidan con lo que se cobra, los lee de la misma configuración que
-- usa el sistema. Solo se abre la lectura de los valores del plan de referidos (los que empiezan con
-- "referidos_"): el resto de la configuración sigue siendo privada.
--
-- Para DESHACER: drop policy if exists referidos_config_publica on configuracion_ortodoncia;
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists referidos_config_publica on configuracion_ortodoncia;
create policy referidos_config_publica on configuracion_ortodoncia
  for select to anon, authenticated
  using (clave like 'referidos\_%');
