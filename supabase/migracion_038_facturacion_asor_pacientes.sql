-- Migración 038: detalle de facturación de ASOR por paciente (línea por
-- línea, con el presupuesto interno de ASOR) — separado de
-- facturacion_obras_sociales, que se genera solo desde los cobros de Caja.
-- Este es el detalle que manda ASOR en sus reportes en PDF.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists facturacion_asor_pacientes (
  id uuid primary key default gen_random_uuid(),
  obra_social text not null,
  nro_presupuesto text not null,
  paciente text not null,
  nro_doc text,
  codigo_prestacion text,
  concepto text,
  total_prestacion numeric not null default 0,
  pendiente_liquidar numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists facturacion_asor_pacientes_obra_social_idx on facturacion_asor_pacientes (obra_social);
create index if not exists facturacion_asor_pacientes_nro_presupuesto_idx on facturacion_asor_pacientes (nro_presupuesto);

alter table facturacion_asor_pacientes enable row level security;
drop policy if exists autenticados_todo on facturacion_asor_pacientes;
create policy autenticados_todo on facturacion_asor_pacientes for all using (es_staff()) with check (es_staff());
