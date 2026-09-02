-- Migración 056: Carga de precios del mecánico "Dental Pin" en la
-- Comparativa de Mecánicos, según la lista de precios que mandaron.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.
-- IMPORTANTE: correr esto una sola vez (si se corre dos veces, duplica las filas).

insert into mecanicos_precios (laboratorio, categoria, trabajo, precio, observaciones, actualizado_en) values
  -- Armazón Cromo Cobalto
  ('Dental Pin', 'Armazón Cromo Cobalto', 'Esqueleto estándar', 100000, null, current_date),
  ('Dental Pin', 'Armazón Cromo Cobalto', 'Base colada superior o inferior completa', 100000, null, current_date),
  ('Dental Pin', 'Armazón Cromo Cobalto', 'Prótesis cromo cobalto terminada', 208000, 'Valor terminado, dato directo del mecánico (no está en la lista impresa).', current_date),

  -- Reparaciones - Rebases
  ('Dental Pin', 'Reparaciones y Rebases', 'Reparación con refuerzo', 22000, null, current_date),
  ('Dental Pin', 'Reparaciones y Rebases', 'Reparación simple', 16000, null, current_date),
  ('Dental Pin', 'Reparaciones y Rebases', 'Reparación agregar un diente o gancho', 18000, null, current_date),
  ('Dental Pin', 'Reparaciones y Rebases', 'Subsiguiente (reparación) c/u', 3000, null, current_date),
  ('Dental Pin', 'Reparaciones y Rebases', 'Rebasado de prótesis', 22000, null, current_date),

  -- Varios
  ('Dental Pin', 'Varios', 'Placa de blanqueamiento', 22000, null, current_date),
  ('Dental Pin', 'Varios', 'Cubeta individual', 15000, null, current_date),
  ('Dental Pin', 'Varios', 'Rodete de mordida', 10000, null, current_date),
  ('Dental Pin', 'Varios', 'Placa neuro-mio relajante', 24000, null, current_date),
  ('Dental Pin', 'Varios', 'Placa miorelajante acrílico', 50000, null, current_date),
  ('Dental Pin', 'Varios', 'Protector bucal', 26000, null, current_date),
  ('Dental Pin', 'Varios', 'Modelo parcial impresión 3D', 14000, null, current_date),
  ('Dental Pin', 'Varios', 'Modelo completo impresión 3D', 16000, null, current_date),

  -- Prótesis fija metálica
  ('Dental Pin', 'Prótesis fija metálica', 'Corona colada entera', 31000, null, current_date),
  ('Dental Pin', 'Prótesis fija metálica', 'Corona espiga', 36000, null, current_date),
  ('Dental Pin', 'Prótesis fija metálica', 'Incrustaciones', 26000, null, current_date),
  ('Dental Pin', 'Prótesis fija metálica', 'Perno directo', 15000, null, current_date),
  ('Dental Pin', 'Prótesis fija metálica', 'Perno indirecto', 20000, null, current_date),
  ('Dental Pin', 'Prótesis fija metálica', 'Perno muñón con pasantes', 22000, null, current_date),
  ('Dental Pin', 'Prótesis fija metálica', 'Corona forjada', 20000, null, current_date),

  -- Ceramage
  ('Dental Pin', 'Ceramage', 'Corona', 60000, null, current_date),
  ('Dental Pin', 'Ceramage', 'Incrustación', 50000, null, current_date),
  ('Dental Pin', 'Ceramage', 'Carilla', 50000, null, current_date),

  -- Prótesis removible
  ('Dental Pin', 'Prótesis removible', 'Prótesis hasta 1 diente', 54000, null, current_date),
  ('Dental Pin', 'Prótesis removible', 'Subsiguiente (diente o gancho)', 4200, null, current_date),
  ('Dental Pin', 'Prótesis removible', 'Prótesis completa', 108000, null, current_date),
  ('Dental Pin', 'Prótesis removible', 'Prótesis flexible', 150000, null, current_date),
  ('Dental Pin', 'Prótesis removible', 'Prótesis flexible unilateral', 115000, null, current_date),
  ('Dental Pin', 'Prótesis removible', 'Arañas', 34000, 'Dato directo del mecánico (no está en la lista impresa).', current_date),

  -- Prótesis híbridas
  ('Dental Pin', 'Prótesis híbridas', 'Base colada sobre 4 implantes', 156000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Prótesis híbridas', 'Base colada sobre 5 implantes o más', 168000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Prótesis híbridas', 'Montaje de dientes acrílicos', 144000, null, current_date),

  -- Cerámica
  ('Dental Pin', 'Cerámica', 'Corona de porcelana sobre metal', 66000, null, current_date),
  ('Dental Pin', 'Cerámica', 'Corona con frente de porcelana', 58000, null, current_date),
  ('Dental Pin', 'Cerámica', 'Incrustación metalocerámica', 48000, null, current_date),
  ('Dental Pin', 'Cerámica', 'Corona metalocerámica sobre implantes', 66000, 'No incluye el valor de los uclas.', current_date),

  -- Cerámica pura
  ('Dental Pin', 'Cerámica pura', 'Corona de circonio monolítica', 100000, null, current_date),
  ('Dental Pin', 'Cerámica pura', 'Incrustación de circonio', 100000, null, current_date),
  ('Dental Pin', 'Cerámica pura', 'Corona de circonio estratificada', 115000, null, current_date),
  ('Dental Pin', 'Cerámica pura', 'Corona PMMA', 60000, null, current_date),
  ('Dental Pin', 'Cerámica pura', 'Corona PMMA Multicapa', 64000, null, current_date),
  ('Dental Pin', 'Cerámica pura', 'Disilicato de litio', 115000, null, current_date),
  ('Dental Pin', 'Cerámica pura', 'Prueba de resina', 12000, null, current_date),

  -- Prótesis fijas de acrílico
  ('Dental Pin', 'Prótesis fijas de acrílico', 'Corona con frente de acrílico', 43000, null, current_date),
  ('Dental Pin', 'Prótesis fijas de acrílico', 'Corona de acrílico pura', 20000, 'Con carillas, +2.000.', current_date),
  ('Dental Pin', 'Prótesis fijas de acrílico', 'Corona provisoria acrílico o póntico', 14000, 'Con carillas, +2.000.', current_date),
  ('Dental Pin', 'Prótesis fijas de acrílico', 'Puente Maryland', 28000, null, current_date),

  -- Attachments
  ('Dental Pin', 'Attachments', 'Perno con attache', 43000, null, current_date),
  ('Dental Pin', 'Attachments', 'Colocación de 1 attache', 34000, null, current_date),
  ('Dental Pin', 'Attachments', 'Colocación de 2 attaches', 66000, null, current_date),
  ('Dental Pin', 'Attachments', 'Colocación de 3 attaches', 100000, null, current_date),
  ('Dental Pin', 'Attachments', 'Colocación de 4 attaches', 132000, null, current_date),

  -- Implantología
  ('Dental Pin', 'Implantología', 'Cubeta de transferencia', 18000, null, current_date),
  ('Dental Pin', 'Implantología', 'Colado de ucla calcinable paralelizado', 28000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Implantología', 'Colado de ucla con attache', 47000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Implantología', 'Corona roscada - metal o cerámica', 70000, null, current_date),
  ('Dental Pin', 'Implantología', 'Fresado de pilares macizos', 8000, null, current_date),

  -- Barras
  ('Dental Pin', 'Barras', 'Barra sobre 2 implantes', 84000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Barras', 'Barra sobre 3 implantes', 120000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Barras', 'Barra sobre 4 implantes o más', 144000, 'No incluye el valor de los uclas.', current_date),
  ('Dental Pin', 'Barras', 'Sobre-estructura', 72000, null, current_date),
  ('Dental Pin', 'Barras', 'Attachs sobre barra (cada uno)', 29000, null, current_date),
  ('Dental Pin', 'Barras', 'Prótesis activadas sobre barras', 108000, null, current_date);
