create table if not exists caja_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  paciente_id uuid references pacientes_ortodoncia(id),
  ortodoncista_id uuid references profesionales(id),
  concepto text not null check (concepto in (
    'Control', 'Reposición de bracket', 'Instalación (contado)', 'Instalación (2 cuotas)',
    'Desinstalación', 'Consulta de ortodoncia', 'Urgencia'
  )),
  cantidad_controles_abonados integer,
  bracket_reposicion text check (bracket_reposicion in ('Metálico', 'Porcelana')),
  cantidad_brackets integer,
  importe numeric not null,
  medio_pago text not null check (medio_pago in ('Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago', 'QR')),
  destino text not null check (destino in ('Caja', 'Banco')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists caja_ortodoncia_fecha_idx on caja_ortodoncia (fecha);
alter table caja_ortodoncia enable row level security;
create policy autenticados_todo on caja_ortodoncia for all using (auth.uid() is not null) with check (auth.uid() is not null);
