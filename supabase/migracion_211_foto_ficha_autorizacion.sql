-- Migración 211: foto o PDF de la ficha de autorización de obra social.
--
-- Cada ficha de "Autorizaciones" puede llevar adjunta la foto (o el PDF) de lo que se manda a la obra social. El archivo se guarda en el
-- mismo lugar que los comprobantes (bucket "comprobantes", privado) y acá queda la ruta.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table autorizaciones_obra_social
  add column if not exists archivo_path text;
