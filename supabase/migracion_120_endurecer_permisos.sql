-- Migración 120: ajustes de seguridad encontrados en una auditoría.
--
-- 1) push_subscriptions: solo la Dueña podía guardar/borrar SU PROPIA
--    suscripción de avisos push — la Secretaria también puede (rol
--    habilitado en la pantalla, "Activar avisos"), pero el guardado le
--    fallaba en silencio por este permiso. Ahora cualquiera puede
--    guardar/borrar la suya propia (nunca la de otro), y la Dueña puede
--    ver/borrar cualquiera.
drop policy if exists duena_todo on push_subscriptions;
create policy propia_o_duena on push_subscriptions
  for all using (usuario_id = auth.uid() or es_duena())
  with check (usuario_id = auth.uid() or es_duena());

-- 2) transferencias_caja, planes_pagos_historicos, vinculos_familiares:
--    quedaron con el permiso viejo "auth.uid() is not null" (cualquier
--    cuenta logueada, sin importar el rol) en vez de "es_staff()" (que
--    excluye a Contador y CM) como el resto de la app desde la migración
--    023. No es explotable desde afuera (los altas de cuenta nuevas están
--    desactivadas en Supabase), pero sí deja ver/tocar estos datos a
--    roles que no deberían (Contador, CM).
drop policy if exists autenticados_todo on vinculos_familiares;
create policy autenticados_todo on vinculos_familiares
  for all using (es_staff()) with check (es_staff());

drop policy if exists autenticados_todo on planes_pagos_historicos;
create policy autenticados_todo on planes_pagos_historicos
  for all using (es_staff()) with check (es_staff());

-- transferencias_caja es distinta a las otras dos: el Contador SÍ necesita
-- verla (la pantalla de Caja le muestra las transferencias entrantes/
-- salientes, aunque no pueda crear ni borrar ninguna) — se le agrega un
-- permiso de solo lectura aparte, como ya existe para caja_general y
-- caja_ortodoncia.
drop policy if exists autenticados_todo on transferencias_caja;
create policy autenticados_todo on transferencias_caja
  for all using (es_staff()) with check (es_staff());
drop policy if exists contador_leer on transferencias_caja;
create policy contador_leer on transferencias_caja for select using (es_contador());
