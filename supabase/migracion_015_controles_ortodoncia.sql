create table if not exists controles_ortodoncia (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes_ortodoncia(id),
  anio integer not null,
  ene text check (ene in ('Pago', 'Pagado Anticipado')),
  feb text check (feb in ('Pago', 'Pagado Anticipado')),
  mar text check (mar in ('Pago', 'Pagado Anticipado')),
  abr text check (abr in ('Pago', 'Pagado Anticipado')),
  may text check (may in ('Pago', 'Pagado Anticipado')),
  jun text check (jun in ('Pago', 'Pagado Anticipado')),
  jul text check (jul in ('Pago', 'Pagado Anticipado')),
  ago text check (ago in ('Pago', 'Pagado Anticipado')),
  sep text check (sep in ('Pago', 'Pagado Anticipado')),
  oct text check (oct in ('Pago', 'Pagado Anticipado')),
  nov text check (nov in ('Pago', 'Pagado Anticipado')),
  dic text check (dic in ('Pago', 'Pagado Anticipado')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paciente_id, anio)
);
alter table controles_ortodoncia enable row level security;
create policy autenticados_todo on controles_ortodoncia for all using (auth.uid() is not null) with check (auth.uid() is not null);
