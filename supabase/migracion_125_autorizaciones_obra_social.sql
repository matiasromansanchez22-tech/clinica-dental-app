-- Migración 125: control de autorizaciones de obras sociales.
--
-- Cada fila es una ficha de un paciente que la obra social tiene que
-- autorizar. Simón (Secretaria) la carga como "Para autorizar" y, cuando
-- la obra social responde, la pasa a "Autorizada" con el número de
-- autorización. Es un control aparte del de facturación
-- (facturacion_obras_sociales), que sigue su propio camino.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists autorizaciones_obra_social (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  obra_social text not null,
  numero_afiliado text,
  prestacion text not null,
  estado text not null default 'Para autorizar'
    check (estado in ('Para autorizar', 'Autorizada')),
  fecha_pedido date not null default current_date,
  fecha_autorizacion date,
  numero_autorizacion text,
  observaciones text,
  creado_por uuid references perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autorizaciones_obra_social_estado_idx
  on autorizaciones_obra_social (estado);
create index if not exists autorizaciones_obra_social_paciente_idx
  on autorizaciones_obra_social (paciente_id);

alter table autorizaciones_obra_social enable row level security;

drop policy if exists autorizaciones_obra_social_staff on autorizaciones_obra_social;
create policy autorizaciones_obra_social_staff on autorizaciones_obra_social
  for all using (es_staff()) with check (es_staff());
