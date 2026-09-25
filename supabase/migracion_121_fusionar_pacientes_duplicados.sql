-- Migración 121: fusiona 4 pares de pacientes duplicados encontrados en la
-- auditoría (mismo DNI/fecha de nacimiento/domicilio — misma persona
-- cargada dos veces). Se deja todo bajo el ID del paciente que tenía más
-- actividad cargada, se mueve el resto ahí, y el duplicado vacío se manda
-- a la papelera (se puede restaurar si hace falta, no se borra para
-- siempre).
--
-- Quedan afuera "Lupich Maia" y "Melgarejo María del Sol" — Matías los
-- tiene que revisar a mano primero (ver el mensaje del chat).
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

do $$
declare
  fusion record;
  tabla text;
  filas_papelera jsonb;
begin
  -- keeper = el que se mantiene, duplicado = el que se vacía y se manda a la papelera
  for fusion in
    select * from (values
      ('5f1c7aec-08aa-4eae-bd21-9b6d7f469143'::uuid, 'f3f934d5-5da3-4d1a-9621-935f9023ebf4'::uuid, 'Gimenez Josefina'),
      ('f6baa3e9-e8e1-4707-b474-d16fc8420705'::uuid, 'b97fa470-e20a-42a4-ad06-30ea3b5a2672'::uuid, 'Gimenez Karina'),
      ('c942f114-668d-433a-a609-c0c38b1bc6ac'::uuid, 'ecc35a90-4e9b-4e5e-bcb0-8a79d6a8ec8e'::uuid, 'Riveros Bianca'),
      ('26221024-3a1c-4166-bcc7-a096ae9b96f7'::uuid, '6848c9e5-6c85-4d90-8106-a67992e48d07'::uuid, 'Tolosa Sergio')
    ) as t(keeper, duplicado, nombre)
  loop
    raise notice 'Fusionando: %', fusion.nombre;

    foreach tabla in array array[
      'turnos_general', 'presupuestos', 'planes_financiacion', 'caja_general',
      'facturacion_obras_sociales', 'prestaciones_realizadas_agenda',
      'historial_clinico_general_entradas', 'odontograma_estado', 'saldos_a_favor',
      'laboratorio', 'panoramicas', 'calendario_contenido'
    ]
    loop
      execute format('update %I set paciente_id = $1 where paciente_id = $2', tabla)
        using fusion.keeper, fusion.duplicado;
    end loop;

    update vinculos_familiares set paciente_id = fusion.keeper where paciente_id = fusion.duplicado;
    update vinculos_familiares set paciente_vinculado_id = fusion.keeper where paciente_vinculado_id = fusion.duplicado;

    -- Guarda una copia del paciente duplicado en la papelera antes de borrarlo.
    select to_jsonb(p) into filas_papelera from pacientes p where p.id = fusion.duplicado;
    if filas_papelera is not null then
      insert into papelera (tabla, registro_id, datos) values ('pacientes', fusion.duplicado, filas_papelera);
      delete from pacientes where id = fusion.duplicado;
    end if;
  end loop;
end $$;
