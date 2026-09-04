-- Migración 063: Rol "Contador" — acceso de solo lectura a lo financiero
-- (Caja, Gastos, Facturación de Obras Sociales, Pagos ASOR, Producción y
-- liquidación, Balances), SIN acceso a nada de pacientes/clínica (agenda,
-- historia clínica, panorámicas, chat, laboratorio, stock, presupuestos).
--
-- Cómo funciona: es_staff() ahora excluye al rol Contador, así que TODO lo
-- que ya estaba protegido con es_staff() queda automáticamente bloqueado
-- para el Contador sin tocar esas políticas una por una. Después se agrega,
-- tabla por tabla, una política nueva de "contador_leer" (solo select) SOLO
-- en las tablas que sí necesita ver.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('Secretaria', 'Odontologo', 'Duena', 'Laboratorio', 'Contador'));

create or replace function es_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol <> 'Contador'
  );
$$;

create or replace function es_contador()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'Contador'
  );
$$;

-- Tablas financieras: el Contador solo puede LEER (nunca crear, editar ni
-- borrar un cobro, gasto o pago — eso sigue siendo tarea del personal de
-- la clínica).
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'caja_general', 'caja_ortodoncia', 'gastos', 'pagos_profesionales',
    'facturacion_obras_sociales', 'pagos_asor', 'remitos_asor',
    'facturacion_asor_pacientes', 'cierres_dia_verificados', 'cierres_mes_verificados'
  ]
  loop
    execute format('drop policy if exists contador_leer on %I;', tabla);
    execute format('create policy contador_leer on %I for select using (es_contador());', tabla);
  end loop;
end $$;

-- Nombre de pacientes y profesionales: hace falta para que se vea "quién"
-- pagó/atendió en los reportes de arriba (no expone ficha clínica, esos
-- datos igual quedan bloqueados porque están en otras tablas aparte).
drop policy if exists contador_leer on pacientes;
create policy contador_leer on pacientes for select using (es_contador());
drop policy if exists contador_leer on pacientes_ortodoncia;
create policy contador_leer on pacientes_ortodoncia for select using (es_contador());
drop policy if exists contador_leer on profesionales;
create policy contador_leer on profesionales for select using (es_contador());

-- Importante: "perfiles_leer" pide es_staff(), que el Contador ya no
-- cumple — sin esto, ni siquiera podría leer su propia fila para iniciar
-- sesión y el login le quedaría colgado. Cualquier usuario logueado puede
-- ver SU PROPIA fila (nada más), sea cual sea su rol.
drop policy if exists propio_perfil_leer on perfiles;
create policy propio_perfil_leer on perfiles for select using (id = auth.uid());
