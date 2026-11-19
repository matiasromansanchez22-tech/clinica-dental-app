-- Migración 209: "Boletas de pedidos" — la foto o el PDF de cada boleta de los pedidos que van llegando, con proveedor, fecha, monto y si
-- está pagada. La cargan Simón (Secretaría), Yamila (Laboratorio) y las Dueñas; la Contadora también las ve y las carga.
-- Quien carga una boleta puede corregirla durante 30 minutos; después solo las Dueñas y la Contadora (que también marcan lo pagado).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function puede_boletas()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('Duena', 'Secretaria', 'Laboratorio', 'Contador'));
$$;

create or replace function gestiona_boletas()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('Duena', 'Contador'));
$$;

create table if not exists boletas_pedidos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  proveedor text not null,
  numero text,
  monto numeric not null check (monto >= 0),
  archivo_path text not null,
  pagada boolean not null default false,
  fecha_pago date,
  medio_pago text,
  pagada_por uuid references perfiles(id),
  nota text,
  cargada_por uuid not null default auth.uid() references perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists boletas_pedidos_fecha_idx on boletas_pedidos (fecha desc);

alter table boletas_pedidos enable row level security;

drop policy if exists boletas_ver on boletas_pedidos;
create policy boletas_ver on boletas_pedidos for select using (puede_boletas());

drop policy if exists boletas_crear on boletas_pedidos;
create policy boletas_crear on boletas_pedidos for insert with check (puede_boletas() and cargada_por = auth.uid());

drop policy if exists boletas_corregir on boletas_pedidos;
create policy boletas_corregir on boletas_pedidos for update
  using (gestiona_boletas() or (cargada_por = auth.uid() and created_at > now() - interval '30 minutes'))
  with check (gestiona_boletas() or (cargada_por = auth.uid() and created_at > now() - interval '30 minutes'));

drop policy if exists boletas_borrar on boletas_pedidos;
create policy boletas_borrar on boletas_pedidos for delete
  using (gestiona_boletas() or (cargada_por = auth.uid() and created_at > now() - interval '30 minutes'));
