-- Migración 071: agrega Asistió/No asistió a los turnos de Ortodoncia,
-- igual que ya existe en la Agenda General.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table turnos_ortodoncia
  add column if not exists asistencia text not null default 'Pendiente'
    check (asistencia in ('Pendiente', 'Asistió', 'No asistió', 'Canceló'));
