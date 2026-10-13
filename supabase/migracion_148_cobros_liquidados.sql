-- Migración 148: marcar qué cobros ya se le liquidaron a un profesional.
--
-- Al registrar un pago a un profesional se pueden tildar los cobros (pacientes)
-- que ese pago cubre. Cada cobro tildado queda "Liquidado ✓" con la fecha y el
-- pago que lo cubrió. Si el pago se borra, los cobros vuelven a figurar como
-- pendientes de liquidar (por eso on delete cascade).
--
-- Va en una tabla aparte (no en caja_general) para no tocar cobros de turnos ya
-- cerrados, que están bloqueados para editar.
--
-- Un cobro se liquida una sola vez (unique). Lo ven y marcan Dueñas y
-- Secretarias; la Contadora también, porque registra pagos.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists cobros_liquidados (
  id uuid primary key default gen_random_uuid(),
  pago_profesional_id uuid not null references pagos_profesionales(id) on delete cascade,
  caja_general_id uuid references caja_general(id) on delete cascade,
  caja_ortodoncia_id uuid references caja_ortodoncia(id) on delete cascade,
  registrado_por uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint cobros_liquidados_un_cobro check (num_nonnulls(caja_general_id, caja_ortodoncia_id) = 1)
);
create unique index if not exists cobros_liquidados_general_unico on cobros_liquidados (caja_general_id) where caja_general_id is not null;
create unique index if not exists cobros_liquidados_ortodoncia_unico on cobros_liquidados (caja_ortodoncia_id) where caja_ortodoncia_id is not null;
create index if not exists cobros_liquidados_pago_idx on cobros_liquidados (pago_profesional_id);

alter table cobros_liquidados enable row level security;
drop policy if exists cobros_liquidados_caja_y_contador on cobros_liquidados;
create policy cobros_liquidados_caja_y_contador on cobros_liquidados for all
  using (es_caja() or es_contador()) with check (es_caja() or es_contador());
