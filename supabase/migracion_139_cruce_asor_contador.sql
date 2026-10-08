-- Migración 139: la contadora (rol Contador) puede ver, en solo lectura, el
-- detalle de ASOR cargado por paciente (facturacion_asor_pacientes), para usar
-- la pantalla "Cruce con ASOR" junto con las Dueñas.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_leer on facturacion_asor_pacientes;
create policy contador_leer on facturacion_asor_pacientes for select using (es_contador());
