-- Migración 094: solo la Dueña puede cargar/editar/borrar Gastos y Pagos a
-- Profesionales — nadie más "paga" nada sin que vos lo hagas directamente.
--
-- Hoy esas tablas usan es_staff() para crear (cualquier rol que no sea
-- Contador: Secretaria, Odontólogo, Laboratorio). En la pantalla ya está
-- oculto el botón para la Secretaria, pero eso solo protege la pantalla —
-- a nivel base de datos cualquiera de esos roles podía cargar un pago
-- igual (por ejemplo llamando directo a la base). Esto lo cierra también
-- ahí.
--
-- La Caja (cobros de pacientes) NO se toca: Secretaria sigue pudiendo
-- cargar cobros del día a día como siempre (eso ya tiene su propio
-- bloqueo al cerrar el turno, migración 028).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

drop policy if exists gastos_crear on gastos;
create policy gastos_crear on gastos for insert with check (es_duena());
drop policy if exists gastos_modificar on gastos;
create policy gastos_modificar on gastos for update using (es_duena()) with check (es_duena());
drop policy if exists gastos_borrar on gastos;
create policy gastos_borrar on gastos for delete using (es_duena());

drop policy if exists pagos_profesionales_crear on pagos_profesionales;
create policy pagos_profesionales_crear on pagos_profesionales for insert with check (es_duena());
drop policy if exists pagos_profesionales_modificar on pagos_profesionales;
create policy pagos_profesionales_modificar on pagos_profesionales for update using (es_duena()) with check (es_duena());
drop policy if exists pagos_profesionales_borrar on pagos_profesionales;
create policy pagos_profesionales_borrar on pagos_profesionales for delete using (es_duena());
