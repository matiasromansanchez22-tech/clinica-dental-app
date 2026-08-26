create table if not exists categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);
insert into categorias_gasto (nombre) values
  ('Alquiler'), ('Sueldos'), ('Insumos Odontológicos'), ('Insumos Ortodoncia'),
  ('Servicios (luz, agua, internet)'), ('Impuestos'), ('Mantenimiento'), ('Marketing'), ('Otro')
on conflict (nombre) do nothing;
alter table categorias_gasto enable row level security;
create policy autenticados_leer on categorias_gasto for select using (auth.uid() is not null);
create policy duena_escribe on categorias_gasto for all using (es_duena()) with check (es_duena());

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  categoria text not null,
  especialidad text check (especialidad in ('General', 'Ortodoncia')),
  descripcion text,
  monto numeric not null,
  medio_pago text not null check (medio_pago in ('Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Mercado Pago', 'QR')),
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on gastos (fecha);
alter table gastos enable row level security;
create policy autenticados_todo on gastos for all using (auth.uid() is not null) with check (auth.uid() is not null);
