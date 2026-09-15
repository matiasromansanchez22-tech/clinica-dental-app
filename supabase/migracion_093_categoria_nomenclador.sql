-- Separa, dentro de una misma obra social, las prestaciones "Comunes" de
-- las de "Prótesis" — ASOR liquida esos dos grupos en transferencias
-- distintas (ej. IAPOS), así que hace falta poder filtrarlas aparte tanto
-- en Control de Obras Sociales como al conciliar un pago de ASOR.

alter table nomenclador add column if not exists categoria text not null default 'Común'
  check (categoria in ('Común', 'Prótesis'));

alter table facturacion_obras_sociales add column if not exists categoria text not null default 'Común'
  check (categoria in ('Común', 'Prótesis'));

create index if not exists facturacion_os_categoria_idx on facturacion_obras_sociales (categoria);

-- El nomenclador dental (rubro 4 = Prótesis) usa códigos que arrancan con
-- "4" para todo lo de prótesis (coronas, puentes, placas, composturas,
-- etc.) — se usa esa misma regla para clasificar automáticamente lo ya
-- cargado. Se puede corregir a mano después desde la pantalla de
-- Nomenclador si algún código no encaja.
update nomenclador set categoria = 'Prótesis' where codigo like '4%';
update facturacion_obras_sociales set categoria = 'Prótesis' where codigo like '4%';
