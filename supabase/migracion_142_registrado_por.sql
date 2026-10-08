-- Migración 142: guarda QUIÉN cargó cada pago a profesional y cada gasto.
--
-- La columna usuario_id se completa sola con el usuario que está logueado al
-- guardar (default auth.uid()), así no hay que tocar cada pantalla que carga
-- pagos o gastos. Los registros anteriores quedan sin ese dato (se ve "—").
-- Si algún día se borra un usuario, el dato queda vacío en vez de trabar el
-- borrado (on delete set null).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table pagos_profesionales
  add column if not exists usuario_id uuid references perfiles(id) on delete set null;
alter table pagos_profesionales alter column usuario_id set default auth.uid();

alter table gastos
  add column if not exists usuario_id uuid references perfiles(id) on delete set null;
alter table gastos alter column usuario_id set default auth.uid();
