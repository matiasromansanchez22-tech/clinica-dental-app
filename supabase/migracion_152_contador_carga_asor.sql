-- Migración 152: la contadora (rol Contador) puede CARGAR y BORRAR el detalle de ASOR por
-- paciente (facturacion_asor_pacientes), que es lo que hace "Importar PDF de ASOR" en Pagos ASOR.
-- Hasta ahora solo podía leerlo (migración 139) y al confirmar la carga le salía:
-- "new row violates row-level security policy for table facturacion_asor_pacientes".
--
-- Al borrar, la fila pasa antes por la Papelera (el permiso para eso ya lo tiene desde la
-- migración 140). No se le da permiso de editar.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists contador_cargar on facturacion_asor_pacientes;
create policy contador_cargar on facturacion_asor_pacientes for insert with check (es_contador());

drop policy if exists contador_borrar on facturacion_asor_pacientes;
create policy contador_borrar on facturacion_asor_pacientes for delete using (es_contador());

-- Para borrar, la app primero guarda una copia en la Papelera. Se comprobó con un usuario
-- contador de prueba que ese paso estaba bloqueado (la política de la migración 140 no
-- estaba activa en la base), así que se vuelve a crear. Esto también arregla que la
-- contadora pueda borrar gastos.
drop policy if exists contador_papelera_insertar on papelera;
create policy contador_papelera_insertar on papelera for insert with check (es_contador());
