-- Habilita Supabase Realtime en prestaciones_realizadas_agenda, para que
-- el aviso flotante ("listo para cobrar") le aparezca al secretario en
-- cualquier pantalla apenas el profesional marca algo en Agenda, sin tener
-- que refrescar ni estar parado en Caja.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.
alter publication supabase_realtime add table prestaciones_realizadas_agenda;
