alter table controles_ortodoncia
  add column if not exists estado_gestion text check (estado_gestion in (
    'Sin gestionar', 'Contactado - sin respuesta', 'Contactado - acordó pago', 'Pagó', 'No va a pagar'
  )),
  add column if not exists detalle_gestion text,
  add column if not exists fecha_ultimo_contacto date;
