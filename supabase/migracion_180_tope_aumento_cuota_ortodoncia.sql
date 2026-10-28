-- Migración 180: el aumento de la cuota de control de Ortodoncia tiene un TOPE: el precio de catálogo.
--
-- Hasta ahora, cada 6 meses la cuota subía un 25% sin límite (50.000 → 62.500 → ...). Ahora la cuota con aumento nunca
-- supera el precio de catálogo del tipo de brackets (Ortodoncia → Catálogo de Precios: «cuota_control_metalico» y
-- «cuota_control_porcelana»). Un paciente que ya está en el tope o por encima no recibe aumento. Si se cambia el precio
-- de catálogo, el tope sube con él.
--
-- Esta migración actualiza el bloqueo que impide a una secretaria cobrar un control por menos de la cuota con aumento
-- (migraciones 155, 174 y 176): ahora calcula la cuota con aumento con el mismo tope que usa la app.
--
-- Para DESHACER: volver a correr la migración 176.
--
-- Copiar y pegar en Supabase → SQL Editor → Run.

create or replace function validar_aumento_ortodoncia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor_control numeric;
  v_proximo_aumento date;
  v_tipo_brackets text;
  v_tope numeric;
  v_porcentaje numeric;
  v_cuota_nueva numeric;
  v_saldo numeric;
  v_minimo numeric;
begin
  if auth.uid() is null or es_duena() then
    return new;
  end if;
  -- Un descuento por referido solo se acepta si hay un referido registrado de ese paciente.
  if coalesce(new.descuento_referido, 0) > 0 then
    if new.referido_ref is null or not exists (
      select 1 from referidos_ortodoncia r
       where r.id = new.referido_ref
         and (r.referido_id = new.paciente_id or r.referidor_id = new.paciente_id)
    ) then
      raise exception 'El descuento por referido no corresponde: ese paciente no tiene un referido registrado.'
        using errcode = 'check_violation';
    end if;
  end if;
  -- Un descuento por fidelidad solo se acepta si ese paciente tiene un premio de la tarjeta.
  if coalesce(new.descuento_fidelidad, 0) > 0 then
    if new.fidelidad_ref is null or not exists (
      select 1 from fidelidad_ortodoncia f
       where f.id = new.fidelidad_ref
         and f.paciente_id = new.paciente_id
    ) then
      raise exception 'El descuento por la tarjeta de fidelidad no corresponde: ese paciente no tiene un premio habilitado.'
        using errcode = 'check_violation';
    end if;
  end if;
  if new.concepto <> 'Control' or new.paciente_id is null then
    return new;
  end if;

  select valor_control, proximo_aumento, tipo_brackets
    into v_valor_control, v_proximo_aumento, v_tipo_brackets
    from pacientes_ortodoncia
   where id = new.paciente_id;

  if v_valor_control is null or v_valor_control <= 0
     or v_proximo_aumento is null or v_proximo_aumento >= new.fecha then
    return new;
  end if;

  select coalesce((select valor from configuracion_ortodoncia where clave = 'aumento_porcentaje'), 25)
    into v_porcentaje;

  v_cuota_nueva := round(v_valor_control * (1 + v_porcentaje / 100) / 100) * 100;

  -- Tope: el precio de catálogo del tipo de brackets. Nunca baja de lo que ya paga.
  if v_tipo_brackets is not null then
    select valor into v_tope
      from configuracion_ortodoncia
     where clave = case when v_tipo_brackets = 'Metalicos' then 'cuota_control_metalico' else 'cuota_control_porcelana' end;
    if v_tope is not null and v_tope > 0 then
      v_cuota_nueva := least(v_cuota_nueva, v_tope);
    end if;
  end if;
  v_cuota_nueva := greatest(v_cuota_nueva, v_valor_control);

  select coalesce(sum(monto), 0)
    into v_saldo
    from saldos_a_favor
   where paciente_ortodoncia_id = new.paciente_id;

  v_minimo := v_cuota_nueva * coalesce(new.cantidad_controles_abonados, 1) - greatest(v_saldo, 0)
              - coalesce(new.descuento_referido, 0) - coalesce(new.descuento_fidelidad, 0);

  if new.importe < v_minimo - 1 then
    raise exception 'Este paciente tiene aumento: el Control no puede cobrarse por menos de $% (cuota con aumento $%). Si hay un descuento autorizado, lo carga una dueña.',
      to_char(round(v_minimo), 'FM999G999G999'), to_char(v_cuota_nueva, 'FM999G999G999')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists bloqueo_aumento_ortodoncia on caja_ortodoncia;
create trigger bloqueo_aumento_ortodoncia
  before insert or update of importe, concepto, cantidad_controles_abonados, paciente_id, fecha, descuento_referido, descuento_fidelidad
  on caja_ortodoncia
  for each row execute function validar_aumento_ortodoncia();
