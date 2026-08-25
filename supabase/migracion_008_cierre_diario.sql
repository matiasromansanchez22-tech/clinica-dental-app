-- Migración 008: Cierre Diario General.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists cierres_diarios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  anio integer not null,
  mes text not null,
  efectivo numeric not null default 0,
  transferencia numeric not null default 0,
  debito numeric not null default 0,
  credito numeric not null default 0,
  mercado_pago numeric not null default 0,
  qr numeric not null default 0,
  total_general numeric not null default 0,
  responsable text,
  guardado_en timestamptz not null default now(),
  observaciones text
);
