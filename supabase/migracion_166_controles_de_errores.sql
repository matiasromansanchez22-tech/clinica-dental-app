-- Migración 166: controles para que no se escapen errores de caja.
--
--  1) revisiones_control: lo que la Dueña marca como "revisado" en la pantalla "Qué revisar" (un posible pago duplicado que en
--     realidad eran dos pagos distintos, un paciente que vino y no pagaba, etc.), con la nota de por qué. Así esa alerta no
--     vuelve a aparecer. La Contadora solo puede ver.
--
--  2) Un pago o gasto cargado por la Contadora NUNCA sale de la reserva: se guarda siempre como gasto del mes. Antes dependía
--     de que ella destildara una casilla; si se olvidaba, la plata salía de la reserva y no restaba del Balance Mensual. Se
--     fuerza en la base de datos (no solo en la pantalla), así no se puede saltear.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists revisiones_control (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  tipo text not null,
  nota text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table revisiones_control enable row level security;
drop policy if exists revisiones_control_duena on revisiones_control;
create policy revisiones_control_duena on revisiones_control for all using (es_duena()) with check (es_duena());
drop policy if exists revisiones_control_contador_ver on revisiones_control;
create policy revisiones_control_contador_ver on revisiones_control for select using (es_contador());

create or replace function forzar_sin_reserva_si_es_contador()
returns trigger
language plpgsql
as $$
begin
  if es_contador() then
    new.desde_reserva := false;
  end if;
  return new;
end;
$$;

drop trigger if exists gastos_contador_sin_reserva on gastos;
create trigger gastos_contador_sin_reserva
  before insert or update on gastos
  for each row execute function forzar_sin_reserva_si_es_contador();

drop trigger if exists pagos_profesionales_contador_sin_reserva on pagos_profesionales;
create trigger pagos_profesionales_contador_sin_reserva
  before insert or update on pagos_profesionales
  for each row execute function forzar_sin_reserva_si_es_contador();
