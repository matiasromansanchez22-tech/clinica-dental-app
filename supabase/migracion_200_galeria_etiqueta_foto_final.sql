-- Migración 200: rótulo de la foto final en la galería de casos.
--
-- El deslizador de la galería decía siempre "Antes" y "Después". Si la segunda foto es de un tratamiento todavía en curso, decir
-- "Después" sería engañoso. Esta columna guarda lo que dice el rótulo de la segunda foto (por ejemplo "Después" o "Durante el tratamiento").
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table galeria_casos add column if not exists etiqueta_despues text not null default 'Después';
