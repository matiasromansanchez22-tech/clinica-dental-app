-- Migración 108: registro de mensajes de seguimiento enviados.
--
-- Cada vez que alguien toca "Escribir por WhatsApp" en el aviso de
-- seguimiento de presupuestos, queda una fila acá con cuándo se mandó —
-- para no perder de vista a quién ya se le escribió y a quién todavía no.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists presupuestos_seguimientos (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references presupuestos(id) on delete cascade,
  fecha_envio timestamptz not null default now(),
  usuario_id uuid references perfiles(id),
  medio text not null default 'WhatsApp'
);

alter table presupuestos_seguimientos enable row level security;
drop policy if exists staff_todo on presupuestos_seguimientos;
create policy staff_todo on presupuestos_seguimientos for all using (es_staff()) with check (es_staff());
