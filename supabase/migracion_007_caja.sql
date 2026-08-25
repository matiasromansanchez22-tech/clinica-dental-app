-- Migración 007: Caja General + Facturación a Obras Sociales.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists caja_general (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('Particular', 'Obra Social')),
  cobertura text,
  paciente_id uuid not null references pacientes(id),
  profesional_responsable_id uuid references profesionales(id),
  profesional_atencion_id uuid references profesionales(id),
  modalidad text not null default 'Día a día' check (modalidad in ('Día a día', 'Plan de financiación')),
  numero_cuota text,
  prestaciones jsonb not null default '[]',
  importe_total numeric not null default 0,
  pago numeric not null default 0,
  medio_pago text not null check (medio_pago in ('Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago', 'QR')),
  saldo_pendiente numeric,
  estado_cobro text not null default 'Cobrado',
  observaciones text,
  id_documento text,
  tipo_documento text,
  created_at timestamptz not null default now()
);

create index if not exists caja_general_fecha_idx on caja_general (fecha);
create index if not exists caja_general_paciente_idx on caja_general (paciente_id);
create index if not exists caja_general_id_documento_idx on caja_general (id_documento);

create table if not exists facturacion_obras_sociales (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  paciente_id uuid not null references pacientes(id),
  dni text,
  obra_social text not null,
  numero_afiliado text,
  profesional_id uuid references profesionales(id),
  prestacion text not null,
  codigo text,
  cantidad integer not null default 1,
  valor_os numeric not null default 0,
  estado_ficha text not null default 'Pendiente',
  caja_id uuid references caja_general(id),
  observaciones text,
  created_at timestamptz not null default now()
);

create index if not exists facturacion_os_fecha_idx on facturacion_obras_sociales (fecha);
create index if not exists facturacion_os_obra_social_idx on facturacion_obras_sociales (obra_social);
