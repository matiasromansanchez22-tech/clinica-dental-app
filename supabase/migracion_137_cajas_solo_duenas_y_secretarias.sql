-- Migración 137: los cobros, gastos, pagos a profesionales y cierres dejan de
-- poder leerse (ni escribirse) desde la base con los roles Odontólogo y
-- Laboratorio. Quedan habilitadas las Dueñas y las Secretarias (y el Contador
-- en solo lectura, como ya estaba).
--
-- Cómo funciona: se crea es_caja() (Dueña o Secretaria) y, en las tablas de
-- dinero, cada permiso que usaba es_staff() pasa a usar es_caja(). Todo lo
-- demás de cada permiso (cerrado = false, es_duena(), etc.) queda igual.
--
-- Para DESHACER (volver a como estaba): correr el mismo bloque DO de abajo
-- cambiando 'es_caja()' por 'es_staff()' y viceversa.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function es_caja()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol in ('Duena', 'Secretaria')
  );
$$;

do $$
declare
  tabla text;
  pol record;
  usando text;
  chequeo text;
  sentencia text;
begin
  foreach tabla in array array[
    'caja_general', 'caja_ortodoncia', 'gastos', 'pagos_profesionales',
    'cierres_turno', 'cierres_turno_ortodoncia',
    'cierres_dia_verificados', 'cierres_mes_verificados',
    'transferencias_caja', 'saldos_a_favor', 'facturacion_obras_sociales'
  ]
  loop
    for pol in
      select policyname, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
        and tablename = tabla
        and (coalesce(qual, '') like '%es_staff()%' or coalesce(with_check, '') like '%es_staff()%')
    loop
      usando := replace(pol.qual, 'es_staff()', 'es_caja()');
      chequeo := replace(pol.with_check, 'es_staff()', 'es_caja()');
      execute format('drop policy %I on public.%I', pol.policyname, tabla);
      sentencia := format('create policy %I on public.%I for %s', pol.policyname, tabla, pol.cmd);
      if usando is not null then
        sentencia := sentencia || ' using (' || usando || ')';
      end if;
      if chequeo is not null then
        sentencia := sentencia || ' with check (' || chequeo || ')';
      end if;
      execute sentencia;
    end loop;
  end loop;
end $$;
