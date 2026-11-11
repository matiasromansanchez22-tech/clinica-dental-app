-- Migración 201: tercera foto (etapa intermedia) en la galería de casos.
--
-- Un caso puede mostrar tres etapas: "Antes", una del medio (por ejemplo "Con brackets") y la final ("Resultado final" o la que sea).
-- foto_intermedia guarda la ruta de la foto del medio en el almacenamiento "galeria"; etiqueta_intermedia, lo que dice su rótulo.
-- Las dos son opcionales: los casos de dos fotos siguen igual.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

alter table galeria_casos add column if not exists foto_intermedia text;
alter table galeria_casos add column if not exists etiqueta_intermedia text;
