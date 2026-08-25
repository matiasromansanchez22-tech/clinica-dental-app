-- Migración 009: tabla de perfiles (usuario + rol).
-- Todavía SIN seguridad por fila (RLS) — eso lo activamos en la migración 010,
-- después de crear los usuarios reales.
-- Copiar y pegar en Supabase → SQL Editor → Run.

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('Secretaria', 'Odontologo', 'Duena')),
  profesional_id uuid references profesionales(id),
  created_at timestamptz not null default now()
);
