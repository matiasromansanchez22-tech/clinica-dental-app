alter table facturacion_obras_sociales
  add constraint facturacion_os_estado_ficha_check
  check (estado_ficha in ('Pendiente', 'Entregada', 'Rechazada', 'Liquidada'));
