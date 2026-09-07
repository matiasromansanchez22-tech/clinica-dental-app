-- Migración 070: permite marcar un profesional como Inactivo (para
-- cuando ya no atiende pero tiene historial real y no se puede borrar).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table profesionales add column if not exists activo boolean not null default true;
