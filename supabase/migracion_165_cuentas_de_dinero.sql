-- Migración 165: cuadro de "Cuentas" (Galicia, Mercado Pago, etc.).
--
-- Sirve para saber cuánta plata hay en cada cuenta y compararla con el Balance Mensual. Es un control aparte: NO suma ni resta
-- nada en los balances. Pasar plata de Mercado Pago a Galicia es mover plata propia de una cuenta a otra, no un ingreso.
--
--   * cuentas_dinero: las cuentas (arrancan Galicia y Mercado Pago).
--   * movimientos_cuentas: dos tipos de movimiento:
--       - 'Saldo real': lo que la cuenta tiene según el banco / la app del banco en esa fecha.
--       - 'Transferencia': plata que se pasa de una cuenta a otra (origen -> destino).
--
-- Las Dueñas cargan y ven todo. La Contadora solo puede ver.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists cuentas_dinero (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

insert into cuentas_dinero (nombre, orden) values ('Galicia', 1), ('Mercado Pago', 2)
on conflict (nombre) do nothing;

create table if not exists movimientos_cuentas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('Saldo real', 'Transferencia')),
  cuenta_id uuid not null references cuentas_dinero(id),
  cuenta_destino_id uuid references cuentas_dinero(id),
  monto numeric not null check (monto >= 0),
  observaciones text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint movimientos_cuentas_transferencia_valida check (
    (tipo = 'Saldo real' and cuenta_destino_id is null)
    or (tipo = 'Transferencia' and cuenta_destino_id is not null and cuenta_destino_id <> cuenta_id and monto > 0)
  )
);

create index if not exists movimientos_cuentas_fecha_idx on movimientos_cuentas (fecha);

alter table cuentas_dinero enable row level security;
alter table movimientos_cuentas enable row level security;

drop policy if exists cuentas_dinero_duena on cuentas_dinero;
create policy cuentas_dinero_duena on cuentas_dinero for all using (es_duena()) with check (es_duena());
drop policy if exists cuentas_dinero_contador_ver on cuentas_dinero;
create policy cuentas_dinero_contador_ver on cuentas_dinero for select using (es_contador());

drop policy if exists movimientos_cuentas_duena on movimientos_cuentas;
create policy movimientos_cuentas_duena on movimientos_cuentas for all using (es_duena()) with check (es_duena());
drop policy if exists movimientos_cuentas_contador_ver on movimientos_cuentas;
create policy movimientos_cuentas_contador_ver on movimientos_cuentas for select using (es_contador());
