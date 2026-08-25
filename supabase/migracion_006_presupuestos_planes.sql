-- Migración 006: Presupuestos y Plan de Financiación.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists configuracion_general (
  clave text primary key,
  valor numeric not null
);

insert into configuracion_general (clave, valor) values
  ('anticipo_contado_pct', 100),
  ('anticipo_financiado_pct', 40),
  ('cuotas_minimas_financiado', 2)
on conflict (clave) do nothing;

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  fecha date not null default current_date,
  paciente_id uuid not null references pacientes(id),
  profesional_id uuid references profesionales(id),
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Aceptado', 'Anulado')),
  prestaciones jsonb not null default '[]', -- hasta 6: { catalogoId, prestacion, cantidad, tipoPrecio, importe }
  total numeric not null default 0,
  modalidad_pago text check (modalidad_pago in ('Contado', 'Financiado')),
  cantidad_cuotas integer,
  anticipo numeric,
  saldo numeric,
  fecha_aceptacion date,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presupuestos_paciente_idx on presupuestos (paciente_id);

create table if not exists planes_financiacion (
  id uuid primary key default gen_random_uuid(),
  numero_plan text not null unique,
  presupuesto_id uuid not null references presupuestos(id),
  numero_presupuesto text not null,
  fecha date not null default current_date,
  paciente_id uuid not null references pacientes(id),
  profesional_id uuid references profesionales(id),
  estado_plan text not null default 'Activo' check (estado_plan in ('Activo', 'Finalizado', 'Cancelado', 'En Mora')),
  total_tratamiento numeric not null default 0,
  anticipo_acordado numeric not null default 0,
  anticipo_cobrado numeric not null default 0,
  saldo_financiado numeric not null default 0,
  cantidad_cuotas integer not null default 0,
  valor_cuota numeric not null default 0,
  total_pagado numeric not null default 0,
  saldo_pendiente numeric not null default 0,
  cuotas_pagadas integer not null default 0,
  proxima_cuota integer,
  proximo_vencimiento date,
  fecha_ultimo_pago date,
  medio_pago_ultimo_pago text,
  estado_financiero text default 'En curso',
  frecuencia text default 'Mensual',
  dias_atraso integer default 0,
  estado_cobranza text default 'Al día',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planes_financiacion_paciente_idx on planes_financiacion (paciente_id);
