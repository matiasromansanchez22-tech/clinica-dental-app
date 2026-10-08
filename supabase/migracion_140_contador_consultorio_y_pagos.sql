-- Migración 140: la contadora (rol Contador) pasa a llevar los pagos de la
-- clínica. Además de mirar, ahora puede:
--
-- 1) Ver y cargar movimientos del panel CONSULTORIO (la reserva): ingresos,
--    egresos y sueldos de empleados. El panel PERSONAL de cada dueño sigue
--    siendo privado: la base no le deja ni leerlo ni escribirlo.
-- 2) Cargar, corregir y borrar gastos de meses que todavía no se cerraron
--    (los meses ya cerrados solo los toca la Dueña). Para poder borrar, se le
--    permite guardar en la Papelera (donde van todos los borrados), que
--    solo ven las Dueñas.
-- 3) Conciliar el banco (comparar el saldo del sistema con el real).
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
