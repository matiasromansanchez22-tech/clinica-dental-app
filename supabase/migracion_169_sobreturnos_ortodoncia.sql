-- Migración 169: tipo de turno cuando atiende una ortodoncista distinta a la de la ficha del paciente.
--
--   * Prioridad: lo atiende la otra ortodoncista y después vuelve con la suya (como hasta ahora).
--   * Sobreturno: se agenda con la otra ortodoncista para no perder el lugar; si se libera un turno con la suya, se pasa.
--   * Cobertura: la otra ortodoncista atiende solo ese día; no cambia nada.
--
-- Prioridad y Sobreturno siguen marcando prioridad = true (así aparecen en Prioridades). Los turnos que ya eran prioridad quedan como
-- "Prioridad". Los demás turnos quedan sin tipo; la pantalla de Prioridades muestra los que atiende otra ortodoncista y no tienen tipo,
-- para clasificarlos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table turnos_ortodoncia
  add column if not exists tipo_otro_ortodoncista text
  check (tipo_otro_ortodoncista in ('Prioridad', 'Sobreturno', 'Cobertura'));

update turnos_ortodoncia
  set tipo_otro_ortodoncista = 'Prioridad'
  where prioridad = true and tipo_otro_ortodoncista is null;

-- Taiel Díaz (28/10): era un sobreturno con Virginia.
update turnos_ortodoncia
  set tipo_otro_ortodoncista = 'Sobreturno'
  where prioridad = true and motivo_prioridad like 'Sobreturno:%';
