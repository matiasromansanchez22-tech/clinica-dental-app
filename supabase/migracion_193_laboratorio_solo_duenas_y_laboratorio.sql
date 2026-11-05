-- Migración 193: Laboratorio solo para las Dueñas y el rol Laboratorio (Yamila).
--
-- Hasta ahora los trabajos y eventos del laboratorio los podían leer y escribir todos los usuarios de la
-- clínica salvo el Contador (odontólogos, secretarias, asistente y marketing incluidos). Con esto quedan
-- limitados a las Dueñas y a Laboratorio, que son quienes llevan el circuito de los trabajos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function puede_laboratorio()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('Duena', 'Laboratorio'));
$$;

drop policy if exists laboratorio_trabajos_todo on laboratorio_trabajos;
create policy laboratorio_trabajos_todo on laboratorio_trabajos for all using (puede_laboratorio()) with check (puede_laboratorio());

drop policy if exists laboratorio_eventos_todo on laboratorio_eventos;
create policy laboratorio_eventos_todo on laboratorio_eventos for all using (puede_laboratorio()) with check (puede_laboratorio());

drop policy if exists config_laboratorio_leer on configuracion_laboratorio;
create policy config_laboratorio_leer on configuracion_laboratorio for select using (puede_laboratorio());
