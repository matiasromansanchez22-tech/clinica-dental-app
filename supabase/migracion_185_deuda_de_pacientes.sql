-- Migración 185: cuánto le falta pagar a un paciente (para controlar la entrega de los trabajos de Laboratorio).
--
-- Regla de la clínica: un paciente no retira un trabajo si debe algo. Lo que debe es la suma de:
--   · los cobros de Caja General con saldo pendiente, y
--   · lo que falta pagar de sus planes de financiación (Activos o En Mora).
--
-- Los cobros y los planes los ven solo las dueñas y las secretarias. Esta función devuelve SOLO el total por paciente
-- (sin el detalle) a las dueñas, secretarias, laboratorio y contadora, para que Laboratorio pueda ver «Debe $X» sin
-- tener acceso a Caja. Si el usuario no tiene uno de esos roles, no devuelve nada.
--
-- Para DESHACER: drop function deuda_de_pacientes(uuid[]);
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function deuda_de_pacientes(p_ids uuid[])
returns table (paciente_id uuid, saldo_cobros numeric, saldo_plan numeric)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    coalesce((select sum(c.saldo_pendiente) from caja_general c where c.paciente_id = p.id and c.saldo_pendiente > 0), 0),
    coalesce((
      select sum(pl.saldo_pendiente) from planes_financiacion pl
       where pl.paciente_id = p.id and pl.estado_plan in ('Activo', 'En Mora') and pl.saldo_pendiente > 0
    ), 0)
  from unnest(p_ids) as p(id)
  where exists (
    select 1 from perfiles pf where pf.id = auth.uid() and pf.rol in ('Duena', 'Secretaria', 'Laboratorio', 'Contador')
  );
$$;

grant execute on function deuda_de_pacientes(uuid[]) to authenticated;
