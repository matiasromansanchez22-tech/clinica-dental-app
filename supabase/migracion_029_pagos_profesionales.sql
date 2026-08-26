-- Migración 029: registro de pagos a profesionales (lo que sale de caja
-- para liquidarles su parte).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists pagos_profesionales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  profesional_id uuid not null references profesionales(id),
  tipo text not null default 'Copago' check (tipo in ('Copago', 'Obra Social')),
  monto numeric not null default 0,
  medio_pago text not null default 'Efectivo' check (medio_pago in ('Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago', 'QR')),
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists pagos_profesionales_fecha_idx on pagos_profesionales (fecha);
create index if not exists pagos_profesionales_profesional_idx on pagos_profesionales (profesional_id);

alter table pagos_profesionales enable row level security;
drop policy if exists autenticados_todo on pagos_profesionales;
create policy autenticados_todo on pagos_profesionales for all using (es_staff()) with check (es_staff());
