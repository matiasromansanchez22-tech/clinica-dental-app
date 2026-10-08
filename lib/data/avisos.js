import { headerDeSesion } from "@/lib/authHeaders";
import { supabase } from "@/lib/supabaseClient";

// Wrapper de fetch("/api/avisos/enviar") que manda el token de sesión —
// la ruta lo exige para no dejar mandar notificaciones push a cualquiera
// que encuentre la URL, sin estar logueado en la app.
export async function enviarAviso(payload) {
  const headers = await headerDeSesion();
  if (!headers.Authorization) return;
  await fetch("/api/avisos/enviar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

function formatoPesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

// Cuando un trabajo vuelve del mecánico y hay que probárselo al paciente, se les
// avisa a las secretarias para que coordinen el turno de prueba. Nunca frena ni
// rompe el registro del evento: si algo falla, simplemente no llega el aviso.
export function avisarTrabajoLlegoASecretarias(trabajoId) {
  (async () => {
    const { data: t } = await supabase
      .from("laboratorio_trabajos")
      .select("paciente_nombre, tipo_trabajo, pieza, laboratorio")
      .eq("id", trabajoId)
      .maybeSingle();
    if (!t) return;
    const { count } = await supabase
      .from("laboratorio_eventos")
      .select("*", { count: "exact", head: true })
      .eq("trabajo_id", trabajoId)
      .eq("tipo_evento", "Prueba con el paciente");
    const prueba = count ? `Prueba ${count + 1}` : "Primera prueba";
    await enviarAviso({
      titulo: "📥 Llegó un trabajo — dar turno de prueba",
      mensaje: [t.paciente_nombre, `${t.tipo_trabajo}${t.pieza ? ` (${t.pieza})` : ""}`, prueba].filter(Boolean).join(" · "),
      url: "/agenda",
      roles: ["Secretaria"],
    });
  })().catch(() => {});
}

// Cada cobro nuevo en Caja le avisa al Contador (solo a ella): paciente,
// concepto, importe y medio de pago. Nunca frena ni rompe el cobro — si algo
// falla (sin conexión, sin aviso activado) simplemente no llega el aviso.
export function avisarCobroAlContador({ esOrtodoncia, pacienteId, concepto, importe, medioPago, desglosePago }) {
  (async () => {
    const { data } = await supabase
      .from(esOrtodoncia ? "pacientes_ortodoncia" : "pacientes")
      .select(esOrtodoncia ? "nombre" : "apellido_y_nombre")
      .eq("id", pacienteId)
      .maybeSingle();
    const paciente = (esOrtodoncia ? data?.nombre : data?.apellido_y_nombre) || "Paciente";
    const medio = desglosePago?.length
      ? `Mixto (${desglosePago.map((p) => `${p.medio} ${formatoPesos(p.monto)}`).join(" + ")})`
      : medioPago;
    await enviarAviso({
      titulo: `💰 Cobro ${esOrtodoncia ? "Ortodoncia" : "General"} — ${formatoPesos(importe)}`,
      mensaje: [paciente, concepto, medio].filter(Boolean).join(" · "),
      url: esOrtodoncia ? "/ortodoncia/caja" : "/caja",
      roles: ["Contador"],
    });
  })().catch(() => {});
}
