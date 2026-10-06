-- Migración 130: el Contador puede LEER las categorías de gasto.
--
-- Sin esto veía la lista vacía y no sabía cuáles categorías "salen de la
-- reserva" (alquiler, marketing, etc.), así que restaba esos gastos del
-- limpio diario / cierre diario / cierre de mes y le daba distinto que a la
-- Dueña.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_leer on categorias_gasto;
create policy contador_leer on categorias_gasto for select using (es_contador());
