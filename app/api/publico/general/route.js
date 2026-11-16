import { clienteServidor, obtenerMotivosGeneral, obtenerObrasSociales, obtenerPrecioConsultaInicial } from "@/lib/server/consultasOnline";

// Datos para la página pública de Odontología General: los motivos de consulta que puede elegir el paciente, las obras sociales
// (para el selector) y el precio de la consulta inicial. No devuelve nada interno (ni quién atiende cada motivo).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = clienteServidor();
    const [motivos, obrasSociales, precioConsulta] = await Promise.all([obtenerMotivosGeneral(supabase), obtenerObrasSociales(supabase), obtenerPrecioConsultaInicial(supabase)]);
    return Response.json(
      {
        ok: true,
        motivos: motivos.map((m) => ({ clave: m.clave, nombre: m.nombre, descripcion: m.descripcion, accion: m.accion, mensaje: m.mensaje, duracionMin: m.duracion_min })),
        obrasSociales,
        precioConsulta,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (e) {
    return Response.json({ ok: false, ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
