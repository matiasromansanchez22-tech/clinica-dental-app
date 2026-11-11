import { createClient } from "@supabase/supabase-js";

// Valores de Ortodoncia que se muestran en la página pública para pacientes (/ortodoncia-info). Es una ruta pública (sin
// iniciar sesión), por eso devuelve SOLO una lista cerrada de claves de la configuración: precios de instalación, control y
// brackets, y las condiciones de los planes de referidos y fidelidad. Nada más sale de la base.
export const dynamic = "force-dynamic";

const CLAVES_PUBLICAS = [
  "precio_instalacion_metalica_contado",
  "precio_instalacion_metalica_2_cuotas",
  "precio_instalacion_porcelana_contado",
  "precio_instalacion_porcelana_2_cuotas",
  "cuota_control_metalico",
  "cuota_control_porcelana",
  "precio_bracket_metalico",
  "precio_bracket_porcelana",
  "referidos_descuento_instalacion_contado",
  "referidos_descuento_instalacion_2_cuotas",
  "referidos_porcentaje_descuento_control",
  "referidos_cada_cuantos_control_sin_costo",
  "fidelidad_visitas_descuento",
  "fidelidad_porcentaje_descuento",
  "fidelidad_visitas_control_gratis",
];

export async function GET() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from("configuracion_ortodoncia").select("clave, valor").in("clave", CLAVES_PUBLICAS);
    if (error) throw error;
    const valores = Object.fromEntries(data.map((f) => [f.clave, Number(f.valor)]));
    return Response.json({ ok: true, valores }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return Response.json({ ok: false, ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
