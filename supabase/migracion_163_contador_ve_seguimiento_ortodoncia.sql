-- Migración 163: la contadora (rol Contador) puede VER el Seguimiento de Ortodoncia.
--
-- Esa pantalla cruza turnos, cobros, visitas, la grilla de Controles y los precios de Ortodoncia. La contadora ya veía los
-- pacientes y la caja de Ortodoncia; faltaba que pudiera leer (solo lectura) estas tablas. No puede modificar nada.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_ver on turnos_ortodoncia;
create policy contador_ver on turnos_ortodoncia for select using (es_contador());

drop policy if exists contador_ver on prestaciones_realizadas_agenda;
create policy contador_ver on prestaciones_realizadas_agenda for select using (es_contador());

drop policy if exists contador_ver on controles_ortodoncia;
create policy contador_ver on controles_ortodoncia for select using (es_contador());

drop policy if exists contador_ver on configuracion_ortodoncia;
create policy contador_ver on configuracion_ortodoncia for select using (es_contador());

-- Las revisiones del Control de instalaciones: las ve (solo lectura); las carga únicamente una Dueña.
drop policy if exists contador_ver on revision_instalaciones_ortodoncia;
create policy contador_ver on revision_instalaciones_ortodoncia for select using (es_contador());
