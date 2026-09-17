-- Permite cargar un % de descuento en un pedido de insumos, que se
-- descuenta del subtotal para calcular el total final. Se guarda el
-- subtotal (antes del descuento) aparte, para que quede reflejado cuánto
-- se ahorró.
alter table pedidos_insumos add column if not exists subtotal numeric;
alter table pedidos_insumos add column if not exists descuento_porcentaje numeric default 0;

-- Para los pedidos ya cargados (sin descuento), el subtotal es igual al total.
update pedidos_insumos set subtotal = total where subtotal is null;
