import { supabase } from "@/lib/supabaseClient";

export async function obtenerPacientesActivos() {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, apellido_y_nombre, celular, tipo_paciente, obra_social")
    .eq("estado", "Activo")
    .order("apellido_y_nombre")
    .limit(500);

  if (error) throw error;
  return data;
}

export async function crearPaciente({ apellidoYNombre, celular, tipoPaciente, obraSocial }) {
  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      apellido_y_nombre: apellidoYNombre,
      celular: celular || null,
      tipo_paciente: tipoPaciente,
      obra_social: obraSocial || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
