-- Migración 023: cerrar un agujero de seguridad real.
--
-- Hasta ahora, TODAS las políticas de seguridad (RLS) de la base de datos
-- dicen "cualquier usuario logueado puede leer/escribir" (auth.uid() is not
-- null), sin chequear si esa persona figura en la tabla "perfiles" (la
-- lista de personal real de la clínica).
--
-- El problema: Supabase permite, por configuración de fábrica, que
-- cualquiera con el link de la app cree una cuenta nueva por su cuenta
-- (sin pasar por la pantalla de login que nosotros armamos, con las
-- herramientas de desarrollador del navegador). Esa cuenta nueva quedaría
-- "logueada" a los ojos de la base de datos, aunque la Dueña nunca la haya
-- dado de alta en "perfiles" — y hoy eso alcanzaría para ver y modificar
-- TODOS los datos de pacientes, turnos y caja.
--
-- Esta migración agrega una función es_staff() (igual que ya existe
-- es_duena()) que chequea que el usuario logueado tenga una fila en
-- "perfiles", y la usa en TODAS las políticas que antes solo pedían
-- "estar logueado". A partir de ahora, ni instalando la app ni creándose
-- una cuenta por su cuenta alguien ajeno puede ver o tocar un solo dato:
-- hace falta que la Dueña lo haya dado de alta como personal real.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function es_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid()
  );
$$;

-- Tablas con política "autenticados_todo" (lectura y escritura para el personal).
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'profesionales', 'disponibilidad_profesional', 'pacientes', 'turnos_general',
    'obras_sociales', 'catalogo_prestaciones', 'nomenclador',
    'presupuestos', 'planes_financiacion', 'caja_general',
    'facturacion_obras_sociales', 'cierres_diarios',
    'turnos_ortodoncia', 'controles_ortodoncia', 'pacientes_ortodoncia',
    'gastos', 'caja_ortodoncia'
  ]
  loop
    execute format('drop policy if exists autenticados_todo on %I;', tabla);
    execute format(
      'create policy autenticados_todo on %I for all using (es_staff()) with check (es_staff());',
      tabla
    );
  end loop;
end $$;

-- Tablas de configuración con política "config_leer" (lectura para el personal,
-- escritura solo para la Dueña — eso no cambia).
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'configuracion_copago_escala', 'configuracion_copago_excepcion', 'configuracion_general',
    'configuracion_duracion_ortodoncia', 'configuracion_deuda_ortodoncia', 'configuracion_ortodoncia'
  ]
  loop
    execute format('drop policy if exists config_leer on %I;', tabla);
    execute format('create policy config_leer on %I for select using (es_staff());', tabla);
  end loop;
end $$;

-- Tablas con política "autenticados_leer".
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'configuracion_copago_particular', 'categorias_gasto'
  ]
  loop
    execute format('drop policy if exists autenticados_leer on %I;', tabla);
    execute format('create policy autenticados_leer on %I for select using (es_staff());', tabla);
  end loop;
end $$;

-- perfiles: solo el personal ya dado de alta puede ver el listado.
drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles for select using (es_staff());
