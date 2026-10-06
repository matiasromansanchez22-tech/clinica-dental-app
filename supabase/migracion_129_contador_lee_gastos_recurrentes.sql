-- Migración 129: el Contador puede VER (solo lectura) la lista de "Gastos
-- de la Clínica" (gastos fijos y variables de siempre).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_leer on gastos_recurrentes;
create policy contador_leer on gastos_recurrentes for select using (es_contador());
