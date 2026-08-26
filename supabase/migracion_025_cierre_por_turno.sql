-- Migración 025: Cierre de Turno por secretario/a.
--
-- Hasta ahora el "Cierre Diario" suma TODA la caja del día, sin importar
-- quién cargó cada cobro. Esto agrega:
--   1) Una columna en caja_general que guarda automáticamente quién cargó
--      cada cobro (el usuario logueado en ese momento).
--   2) Una tabla nueva "cierres_turno" para que cada secretario/a pueda
--      cerrar solo lo que él/ella cargó ese día, sin pisar el cierre de
--      otro compañero del mismo día.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table caja_general
  add column if not exists usuario_id uuid references auth.users(id) default auth.uid();

create table if not exists cierres_turno (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  usuario_id uuid not null references auth.users(id),
  nombre_secretaria text,
  efectivo numeric not null default 0,
  transferencia numeric not null default 0,
  debito numeric not null default 0,
  credito numeric not null default 0,
  mercado_pago numeric not null default 0,
  qr numeric not null default 0,
  total_general numeric not null default 0,
  observaciones text,
  guardado_en timestamptz not null default now(),
  unique (fecha, usuario_id)
);

create index if not exists cierres_turno_fecha_idx on cierres_turno (fecha);

alter table cierres_turno enable row level security;
drop policy if exists autenticados_todo on cierres_turno;
create policy autenticados_todo on cierres_turno for all using (es_staff()) with check (es_staff());
