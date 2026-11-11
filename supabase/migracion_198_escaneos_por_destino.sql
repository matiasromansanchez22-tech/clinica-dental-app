-- Migración 198: los escaneos del QR ahora distinguen a qué página llevó el código.
--
-- Hay dos páginas públicas con QR: el plan de referidos y fidelidad (/referidos) y la nueva de consultas de ortodoncia
-- (/ortodoncia-info). La columna "destino" guarda cuál de las dos se abrió: 'referidos' u 'ortodoncia'. Los escaneos que ya
-- estaban quedan como 'referidos'.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table qr_escaneos add column if not exists destino text not null default 'referidos' check (destino in ('referidos', 'ortodoncia'));
create index if not exists qr_escaneos_destino_idx on qr_escaneos (destino, created_at desc);
