-- Migración 080: para poder mostrar, al cargar un trabajo de laboratorio,
-- el catálogo completo de precios de ESE mecánico (nombre + valor, como el
-- catálogo propio de la clínica) en vez de solo sugerir el nombre a ciegas.
--
-- No es información nueva expuesta: el valor puntual de un laboratorio +
-- trabajo ya se mostraba (obtener_precio_mecanico); esto solo devuelve la
-- lista completa de ESE mecánico junto con sus precios, sin tocar el resto
-- de la comparativa (otros mecánicos, contactos, cuál está descartado),
-- que sigue siendo Dueña-only.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function obtener_precios_mecanico(p_laboratorio text)
returns table (trabajo text, precio numeric)
language sql
security definer
set search_path = public
as $$
  select trabajo, precio
  from mecanicos_precios
  where lower(laboratorio) = lower(p_laboratorio)
  order by trabajo;
$$;

grant execute on function obtener_precios_mecanico(text) to authenticated;
