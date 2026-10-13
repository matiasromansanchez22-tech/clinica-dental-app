-- Migración 146: Rol "Asistente" (Karen) — una persona del personal que solo
-- registra su ingreso y egreso (pantalla "Mi horario") para que se calculen
-- las horas trabajadas y se le liquide. No ve pacientes, agenda, cajas ni
-- nada de dinero de la clínica.
--
-- Cómo funciona: es_staff() ahora también excluye a "Asistente" (igual que ya
-- excluye a Contador y CM), así que todo lo protegido con es_staff() queda
-- bloqueado para ella sin tocar esos permisos uno por uno. Lo único que ve es
-- su propia fila de "perfiles" y sus propios registros de horario (ya
-- existentes: horario_propio_o_duena y propio_perfil_leer).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('Secretaria', 'Odontologo', 'Duena', 'Laboratorio', 'Contador', 'CM', 'Asistente'));

create or replace function es_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol not in ('Contador', 'CM', 'Asistente')
  );
$$;
