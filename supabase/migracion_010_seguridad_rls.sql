-- Migración 010: activa la seguridad por fila (RLS) en toda la base.
-- A partir de acá, SOLO usuarios logueados pueden leer o escribir datos —
-- ya no alcanza con tener el link de la app, hace falta un usuario y
-- contraseña real cargados en "perfiles".
--
-- Las tablas de configuración sensible (escala de copago, excepciones,
-- configuración general) solo se pueden EDITAR por el rol "Duena" —
-- el resto de los roles puede leerlas (las necesita el sistema para
-- funcionar) pero no cambiarlas.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

-- Función auxiliar: ¿el usuario logueado es Dueña?
create or replace function es_duena()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'Duena'
  );
$$;

-- Habilitar RLS + policy "cualquier usuario logueado" en las tablas operativas.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'profesionales', 'disponibilidad_profesional', 'pacientes', 'turnos_general',
    'obras_sociales', 'catalogo_prestaciones', 'nomenclador',
    'presupuestos', 'planes_financiacion', 'caja_general',
    'facturacion_obras_sociales', 'cierres_diarios'
  ]
  loop
    execute format('alter table %I enable row level security;', tabla);
    execute format('drop policy if exists autenticados_todo on %I;', tabla);
    execute format(
      'create policy autenticados_todo on %I for all using (auth.uid() is not null) with check (auth.uid() is not null);',
      tabla
    );
  end loop;
end $$;

-- perfiles: cualquier logueado puede leer (para ver el listado de usuarios),
-- pero solo la Dueña puede crear/editar/borrar perfiles.
alter table perfiles enable row level security;
drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles for select using (auth.uid() is not null);
drop policy if exists perfiles_escribir on perfiles;
create policy perfiles_escribir on perfiles for all using (es_duena()) with check (es_duena());

-- Configuración sensible: cualquier logueado la lee, solo Dueña la edita.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'configuracion_copago_escala', 'configuracion_copago_excepcion', 'configuracion_general'
  ]
  loop
    execute format('alter table %I enable row level security;', tabla);
    execute format('drop policy if exists config_leer on %I;', tabla);
    execute format('create policy config_leer on %I for select using (auth.uid() is not null);', tabla);
    execute format('drop policy if exists config_escribir on %I;', tabla);
    execute format('create policy config_escribir on %I for all using (es_duena()) with check (es_duena());', tabla);
  end loop;
end $$;
