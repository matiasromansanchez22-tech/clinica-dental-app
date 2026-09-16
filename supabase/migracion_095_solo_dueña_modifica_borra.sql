-- Migración 095: corrige la 094 — el personal SÍ puede seguir cargando
-- pagos a profesionales y gastos chicos como siempre (eso es trabajo
-- normal del día a día). Lo que no pueden hacer es MODIFICARLOS ni
-- BORRARLOS después de cargados — eso queda solo para la Dueña, sin
-- importar si el día/mes ya se cerró o no (antes se podía tocar mientras
-- no estuviera cerrado; ahora nunca, solo la Dueña).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists gastos_crear on gastos;
create policy gastos_crear on gastos for insert with check (es_staff());
drop policy if exists gastos_modificar on gastos;
create policy gastos_modificar on gastos for update using (es_duena()) with check (es_duena());
drop policy if exists gastos_borrar on gastos;
create policy gastos_borrar on gastos for delete using (es_duena());

drop policy if exists pagos_profesionales_crear on pagos_profesionales;
create policy pagos_profesionales_crear on pagos_profesionales for insert with check (es_staff());
drop policy if exists pagos_profesionales_modificar on pagos_profesionales;
create policy pagos_profesionales_modificar on pagos_profesionales for update using (es_duena()) with check (es_duena());
drop policy if exists pagos_profesionales_borrar on pagos_profesionales;
create policy pagos_profesionales_borrar on pagos_profesionales for delete using (es_duena());
