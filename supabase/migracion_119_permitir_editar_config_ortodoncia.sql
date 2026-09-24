-- Permite que el staff (no solo el service role) edite el catálogo de
-- precios de Ortodoncia desde la app (antes "configuracion_ortodoncia"
-- solo se podía leer).
drop policy if exists config_leer on configuracion_ortodoncia;
create policy config_todo on configuracion_ortodoncia for all using (es_staff()) with check (es_staff());
