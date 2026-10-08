-- Migración 138: completa lo que había quedado sin aplicar de la migración 120
-- (nunca se corrió) y cierra transferencias_caja con el mismo criterio que el
-- resto de las cajas.
--
-- 1) push_subscriptions: cada usuario (Dueña, Secretaria, Contador...) puede
--    guardar y borrar SU suscripción de avisos; la Dueña ve/borra cualquiera.
--    Sin esto, Ane y las secretarias no podían activar los avisos.
-- 2) transferencias_caja: solo Dueñas y Secretarias (el Contador, en solo
--    lectura).
-- 3) planes_pagos_historicos y vinculos_familiares: solo personal de la
--    clínica (no Contador ni Marketing).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists duena_todo on push_subscriptions;
drop policy if exists propia_o_duena on push_subscriptions;
create policy propia_o_duena on push_subscriptions
  for all using (usuario_id = auth.uid() or es_duena())
  with check (usuario_id = auth.uid() or es_duena());

drop policy if exists autenticados_todo on transferencias_caja;
create policy autenticados_todo on transferencias_caja
  for all using (es_caja()) with check (es_caja());
drop policy if exists contador_leer on transferencias_caja;
create policy contador_leer on transferencias_caja for select using (es_contador());

drop policy if exists autenticados_todo on planes_pagos_historicos;
create policy autenticados_todo on planes_pagos_historicos
  for all using (es_staff()) with check (es_staff());

drop policy if exists autenticados_todo on vinculos_familiares;
create policy autenticados_todo on vinculos_familiares
  for all using (es_staff()) with check (es_staff());
