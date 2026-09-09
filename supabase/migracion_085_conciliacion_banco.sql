-- Migración 085: "Conciliar banco" — de vez en cuando se carga el saldo
-- real que muestra el banco, y el sistema calcula la diferencia contra lo
-- que él tiene calculado, para detectar rápido si falta cargar algo (en
-- vez de darse cuenta mucho después).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists conciliaciones_banco (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  cuenta text not null default 'Banco' check (cuenta in ('Efectivo', 'Banco')),
  saldo_sistema numeric not null,
  saldo_real numeric not null,
  diferencia numeric not null,
  observaciones text,
  usuario_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists conciliaciones_banco_fecha_idx on conciliaciones_banco (fecha desc);

alter table conciliaciones_banco enable row level security;
drop policy if exists conciliaciones_banco_duena on conciliaciones_banco;
create policy conciliaciones_banco_duena on conciliaciones_banco for all using (es_duena()) with check (es_duena());
