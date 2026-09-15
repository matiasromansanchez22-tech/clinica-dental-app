import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    monto: Number(f.monto),
    origen: f.origen,
    destino: f.destino,
    medioPago: f.medio_pago,
    observaciones: f.observaciones,
  };
}

export async function obtenerTransferenciasCajaPorFecha(fecha) {
  const { data, error } = await supabase
    .from("transferencias_caja")
    .select("*")
    .eq("fecha", fecha)
    .order("created_at");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearTransferenciaCaja({ fecha, monto, origen, destino, medioPago, observaciones }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("transferencias_caja")
    .insert({
      fecha,
      monto: Number(monto),
      origen,
      destino,
      medio_pago: medioPago || "Efectivo",
      observaciones: observaciones || null,
      usuario_id: user?.id || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarTransferenciaCaja(id) {
  await moverAPapelera("transferencias_caja", id);
}
