-- Migración 153: vuelve a activar los permisos de la contadora (rol Contador) de la migración 140.
--
-- Se comprobó con un usuario contador de prueba que, aunque la 140 figuraba como corrida, en la
-- base NO estaban activos estos permisos: la contadora podía VER Consultorio y los gastos pero la
-- base rechazaba cualquier alta ("new row violates row-level security policy").
--
-- Es idempotente: si algún permiso ya existía, se vuelve a crear igual, sin duplicarse.
--
-- 1) Consultorio (la reserva): ver y cargar ingresos, egresos y sueldos de empleados. El panel
--    Personal de cada dueña sigue siendo privado.
-- 2) Gastos: cargar, corregir y borrar los de meses sin cerrar (los de meses cerrados, solo la Dueña).
--    Para borrar se le permite guardar en la Papelera (ya activado en la 152, se repite sin problema).
-- 3) Conciliación del banco.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- 1) Consultorio
drop policy if exists contador_consultorio on movimientos_personales;
create policy contador_consultorio on movimientos_personales for all
  using (es_contador() and panel = 'Consultorio')
  with check (es_contador() and panel = 'Consultorio');

-- 2) Gastos
drop policy if exists contador_crear on gastos;
create policy contador_crear on gastos for insert with check (es_contador());
drop policy if exists contador_modificar on gastos;
create policy contador_modificar on gastos for update
  using (es_contador() and cerrado = false)
  with check (es_contador());
drop policy if exists contador_borrar on gastos;
create policy contador_borrar on gastos for delete using (es_contador() and cerrado = false);

drop policy if exists contador_papelera_insertar on papelera;
create policy contador_papelera_insertar on papelera for insert with check (es_contador());

-- 3) Conciliación del banco
drop policy if exists contador_todo on conciliaciones_banco;
create policy contador_todo on conciliaciones_banco for all
  using (es_contador()) with check (es_contador());
