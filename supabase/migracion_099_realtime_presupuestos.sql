-- Habilita Supabase Realtime en presupuestos, para que el aviso grande en
-- pantalla (Secretarias) se dispare apenas se guarda un presupuesto nuevo,
-- sin tener que refrescar ni ir a buscarlo a mano.
alter publication supabase_realtime add table presupuestos;
