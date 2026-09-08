-- Migración 079: para poder ver qué trabajos puntuales (de qué pacientes)
-- cubre cada pago a un mecánico — así se puede comparar lo que se pagó
-- contra lo que esos trabajos valen según nuestro sistema, y detectar a
-- tiempo errores como el de Disilicato/Circonio.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists pagos_laboratorio_trabajos (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references gastos(id) on delete cascade,
  trabajo_id uuid not null references laboratorio_trabajos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gasto_id, trabajo_id)
);

alter table pagos_laboratorio_trabajos enable row level security;
drop policy if exists pagos_laboratorio_trabajos_duena on pagos_laboratorio_trabajos;
create policy pagos_laboratorio_trabajos_duena on pagos_laboratorio_trabajos for all using (es_duena()) with check (es_duena());
