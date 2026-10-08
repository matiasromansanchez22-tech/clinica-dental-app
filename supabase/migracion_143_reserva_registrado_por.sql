-- Migración 143: guarda QUIÉN cargó cada movimiento de la reserva de
-- Consultorio (ingresos, egresos, sueldos, pagos con la reserva).
--
-- Igual que en la migración 142: la columna se completa sola con el usuario
-- logueado al guardar (default auth.uid()). Los movimientos anteriores quedan
-- sin ese dato (se ve "—"). Es una columna aparte de usuario_id, que en el
-- panel Personal indica de quién es la plata.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table movimientos_personales
  add column if not exists creado_por uuid references perfiles(id) on delete set null;
alter table movimientos_personales alter column creado_por set default auth.uid();
