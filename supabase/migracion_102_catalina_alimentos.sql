-- Migración 102: registro de alimentos de Catalina (10 meses).
--
-- Privado, igual que "Casa" — no tiene nada que ver con la clínica. Sirve
-- para ir anotando qué alimentos nuevos fue probando, cuándo, y si tuvo
-- alguna reacción (útil para hablar con el pediatra).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists catalina_alimentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros'
    check (categoria in ('Frutas', 'Verduras', 'Cereales y legumbres', 'Lácteos', 'Carnes y pescado', 'Huevo', 'Otros')),
  fecha_primera_vez date,
  estado text not null default 'Le gustó'
    check (estado in ('Le gustó', 'No le gustó', 'Alergia o reacción', 'A probar de nuevo')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table catalina_alimentos enable row level security;
drop policy if exists duena_todo on catalina_alimentos;
create policy duena_todo on catalina_alimentos for all using (es_duena()) with check (es_duena());
