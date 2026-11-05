import { headerDeSesion } from "@/lib/authHeaders";
import { supabase } from "@/lib/supabaseClient";
import { obtenerDeudaDePacientes, textoDeuda } from "@/lib/data/deudaPacientes";

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
      .select("paciente_nombre, tipo_paciente, paciente_id, tipo_trabajo, pieza, laboratorio")
      .eq("id", trabajoId)
      .maybeSingle();
    if (!t) return;
    const deuda = await deudaDelTrabajo(t);
    const { count } = await supabase
      .from("laboratorio_eventos")
      .select("*", { count: "exact", head: true })
      .eq("trabajo_id", trabajoId)
      .eq("tipo_evento", "Prueba con el paciente");
    const prueba = count ? `Prueba ${count + 1}` : "Primera prueba";
    await enviarAviso({
      titulo: "📥 Llegó un trabajo — dar turno de prueba",
      mensaje: [
        t.paciente_nombre,
        `${t.tipo_trabajo}${t.pieza ? ` (${t.pieza})` : ""}`,
        prueba,
        deuda?.total > 0 ? `Debe ${formatoPesos(deuda.total)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      url: "/agenda",
      roles: ["Secretaria"],
    });
  })().catch(() => {});
}

// Lo que debe el paciente de un trabajo (solo pacientes de Odontología General). Devuelve null si no se puede saber.
async function deudaDelTrabajo(t) {
  if (t.tipo_paciente === "Ortodoncia") return null;
  const mapa = await obtenerDeudaDePacientes([t.paciente_id]).catch(() => ({}));
  return mapa[t.paciente_id] || null;
}

// Cuando la prueba sale bien y el trabajo queda listo para entregar, se avisa a las dueñas, a Secretaría y a
// Laboratorio si el paciente todavía debe algo: la regla es que no retira nada si debe.
export function avisarTrabajoListoParaEntregar(trabajoId) {
  (async () => {
    const { data: t } = await supabase
      .from("laboratorio_trabajos")
      .select("paciente_nombre, tipo_paciente, paciente_id, tipo_trabajo, pieza")
      .eq("id", trabajoId)
      .maybeSingle();
    if (!t) return;
    const deuda = await deudaDelTrabajo(t);
    if (!deuda) return; // sin dato (ortodoncia o sin permiso): no se avisa nada que pueda ser falso
    const trabajo = `${t.tipo_trabajo}${t.pieza ? ` (${t.pieza})` : ""}`;
    await enviarAviso(
      deuda.total > 0
        ? {
            titulo: "✅ Trabajo listo — el paciente todavía debe",
            mensaje: `${t.paciente_nombre} · ${trabajo} · Debe ${formatoPesos(deuda.total)} (${textoDeuda(deuda)}). No se entrega hasta que pague.`,
            url: "/laboratorio",
            roles: ["Duena", "Secretaria", "Laboratorio"],
          }
        : {
            titulo: "✅ Trabajo listo para entregar",
            mensaje: `${t.paciente_nombre} · ${trabajo} · No debe nada: se puede entregar.`,
            url: "/laboratorio",
            roles: ["Duena", "Secretaria", "Laboratorio"],
          }
    );
  })().catch(() => {});
}

// Entró mercadería: se cargó un pedido de insumos recibido. Avisa a las dueñas con lo que llegó.
export function avisarMercaderiaNueva({ proveedor, items }) {
  (async () => {
    const lista = (items || []).map((i) => `${i.insumo} (+${Number(i.cantidad) || 0})`);
    if (lista.length === 0) return;
    const visibles = lista.slice(0, 5).join(", ");
    await enviarAviso({
      titulo: "📦 Entró mercadería nueva",
      mensaje: `${proveedor ? proveedor + " · " : ""}${lista.length} insumo${lista.length === 1 ? "" : "s"}: ${visibles}${lista.length > 5 ? ` y ${lista.length - 5} más` : ""}`,
      url: "/gerencial/stock",
      roles: ["Duena"],
    });
  })().catch(() => {});
}

// Cuando alguien suma stock a mano en la grilla de Stock, se juntan los cambios de unos segundos y se manda UN solo
// aviso (si no, cargar 30 insumos seguidos serían 30 notificaciones).
let ingresosPendientes = [];
let temporizadorIngresos = null;
export function avisarIngresoDeStock({ insumo, cantidad, enStock }) {
  ingresosPendientes.push({ insumo, cantidad, enStock });
  if (temporizadorIngresos) clearTimeout(temporizadorIngresos);
  temporizadorIngresos = setTimeout(() => {
    const lote = ingresosPendientes;
    ingresosPendientes = [];
    temporizadorIngresos = null;
    // Si un mismo insumo se tocó varias veces, queda la última cantidad.
    const porInsumo = new Map();
    for (const x of lote) porInsumo.set(x.insumo, x);
    const lista = [...porInsumo.values()].map((x) => `${x.insumo} (+${x.cantidad}, ahora ${x.enStock})`);
    if (lista.length === 0) return;
    enviarAviso({
      titulo: "📦 Se cargó stock nuevo",
      mensaje: `${lista.slice(0, 5).join(", ")}${lista.length > 5 ? ` y ${lista.length - 5} más` : ""}`,
      url: "/gerencial/stock",
      roles: ["Duena"],
    }).catch(() => {});
  }, 45000);
}

// Cuando se completa un rodante (traspaso del Stock a un rodante), se juntan los insumos cargados en unos segundos y se
// manda UN aviso por rodante: cuál se completó, qué se le cargó y quién lo hizo.
const traspasosPendientes = new Map(); // rodante -> Map(insumo -> cantidad)
let temporizadorTraspasos = null;
export function avisarTraspasoARodante({ rodante, insumo, cantidad }) {
  const insumos = traspasosPendientes.get(rodante) || new Map();
  insumos.set(insumo, (insumos.get(insumo) || 0) + (Number(cantidad) || 0));
  traspasosPendientes.set(rodante, insumos);
  if (temporizadorTraspasos) clearTimeout(temporizadorTraspasos);
  temporizadorTraspasos = setTimeout(async () => {
    const lote = [...traspasosPendientes.entries()];
    traspasosPendientes.clear();
    temporizadorTraspasos = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: perfil } = user ? await supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle() : { data: null };
      for (const [nombreRodante, mapa] of lote) {
        const lista = [...mapa.entries()].map(([nombre, cant]) => `${nombre} ×${cant}`);
        await enviarAviso({
          titulo: `🛒 Se completó ${nombreRodante}${perfil?.nombre ? ` — ${perfil.nombre}` : ""}`,
          mensaje: `${lista.slice(0, 6).join(", ")}${lista.length > 6 ? ` y ${lista.length - 6} más` : ""}`,
          url: "/gerencial/stock",
          roles: ["Duena"],
        });
      }
    } catch {
      // el aviso nunca debe romper la carga
    }
  }, 45000);
}

// Insumos que acaban de quedar por debajo de su mínimo (una vez por cada uno hasta que se reponga).
export function avisarPocoStock(insumos) {
  (async () => {
    if (!insumos?.length) return;
    const texto = (i) => (Number(i.enStock) <= 0 ? `${i.nombre} (se terminó)` : `${i.nombre} (quedan ${i.enStock}, mínimo ${i.minimo})`);
    await enviarAviso(
      insumos.length === 1
        ? {
            titulo: `⚠️ Poco stock: ${insumos[0].nombre}`,
            mensaje: Number(insumos[0].enStock) <= 0 ? "Se terminó. Hay que reponer." : `Quedan ${insumos[0].enStock} en Stock (mínimo ${insumos[0].minimo}).`,
            url: "/gerencial/stock",
            roles: ["Duena"],
          }
        : {
            titulo: `⚠️ Poco stock de ${insumos.length} insumos`,
            mensaje: insumos.slice(0, 6).map(texto).join(", ") + (insumos.length > 6 ? ` y ${insumos.length - 6} más` : ""),
            url: "/gerencial/stock",
            roles: ["Duena"],
          }
    );
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
