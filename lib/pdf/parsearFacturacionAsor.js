// Parsea el PDF "Asor | Facturacion en Gestión" (detalle por paciente) a una
// lista de líneas {nroPresupuesto, paciente, nroDoc, codigo, concepto, total,
// pendiente}. pdfjs solo da texto suelto con coordenadas (x,y), sin filas ni
// columnas — hay que reconstruir la tabla.
//
// Las columnas NO caen siempre en la misma posición exacta de un PDF a otro
// (varía unos pocos puntos según el archivo), así que en vez de usar
// posiciones fijas, se detectan las 9 columnas agrupando el propio
// encabezado de cada página por cercanía en x.
//
// Dentro de la tabla, cada fila real siempre trae un valor en "Total x
// Prest" o "Pendiente Liq x ASOR" — las líneas de continuación (cuando el
// nombre del paciente o el concepto se cortan en 2-3 renglones) no lo
// tienen, y esa es la señal para saber dónde empieza cada fila nueva.

const ORDEN_COLUMNAS = ["nro", "paciente", "tipoDoc", "cod", "pieza", "detalle", "concepto", "total", "pendiente"];

function agruparPorBandaY(items, tolerancia = 2) {
  const bandas = [];
  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    const texto = item.str.trim();
    if (!texto) continue;
    let banda = bandas.find((b) => Math.abs(b.y - y) < tolerancia);
    if (!banda) {
      banda = { y, items: [] };
      bandas.push(banda);
    }
    banda.items.push({ x, texto });
  }
  bandas.sort((a, b) => b.y - a.y);
  return bandas;
}

function detectarColumnas(bandas) {
  // El encabezado son las bandas antes de la primera fila de datos real
  // (empieza con un número de 5 a 8 dígitos pegado al margen izquierdo).
  let finEncabezado = bandas.findIndex((b) => {
    const izquierda = b.items.filter((i) => i.x < 90).map((i) => i.texto);
    return izquierda.some((t) => /^\d{5,8}$/.test(t));
  });
  if (finEncabezado === -1) finEncabezado = Math.min(3, bandas.length);

  const itemsEncabezado = bandas
    .slice(0, finEncabezado)
    .flatMap((b) => b.items)
    .filter(
      (it) =>
        !it.texto.includes("Asor |") &&
        !it.texto.includes("Facturacion en Gesti") &&
        it.texto !== "[$]" &&
        it.texto !== "$"
    );
  if (itemsEncabezado.length === 0) return null;

  // Agrupar por cercanía en x (misma columna aunque el título se corte en
  // 2-3 líneas).
  const grupos = [];
  for (const it of itemsEncabezado.sort((a, b) => a.x - b.x)) {
    let grupo = grupos.find((g) => Math.abs(g.x - it.x) < 20);
    if (!grupo) {
      grupo = { x: it.x };
      grupos.push(grupo);
    }
  }
  grupos.sort((a, b) => a.x - b.x);

  // Tomar como máximo 9 grupos (por si el título general "Asor | ..." quedó
  // adentro del rango, o hay ruido) — nos quedamos con los últimos 9, que
  // son los de la fila de columnas real.
  const inicios = grupos.slice(-9).map((g) => g.x);
  while (inicios.length < 9) inicios.unshift(0);

  const columnas = {};
  ORDEN_COLUMNAS.forEach((nombre, i) => {
    const desde = i === 0 ? 0 : (inicios[i - 1] + inicios[i]) / 2;
    const hasta = i === ORDEN_COLUMNAS.length - 1 ? Infinity : (inicios[i] + inicios[i + 1]) / 2;
    columnas[nombre] = [desde, hasta];
  });
  return columnas;
}

function columnaDe(x, columnas) {
  for (const nombre of ORDEN_COLUMNAS) {
    const [desde, hasta] = columnas[nombre];
    if (x >= desde && x < hasta) return nombre;
  }
  return null;
}

function numeroDesde(texto) {
  const limpio = String(texto || "").replace(/\./g, "").replace(",", ".").trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return isNaN(n) ? null : n;
}

export async function parsearFacturacionAsorPdf(arrayBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(arrayBuffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;

  const lineas = [];
  let ultimasColumnas = null;
  let filaActual = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const bandas = agruparPorBandaY(content.items);

    const columnas = detectarColumnas(bandas) || ultimasColumnas;
    if (!columnas) continue;
    ultimasColumnas = columnas;

    const filasDeTexto = bandas
      .map((banda) => {
        const porColumna = { nro: "", paciente: "", tipoDoc: "", cod: "", pieza: "", detalle: "", concepto: "", total: "", pendiente: "" };
        for (const it of [...banda.items].sort((a, b) => a.x - b.x)) {
          const col = columnaDe(it.x, columnas);
          if (!col) continue;
          porColumna[col] += (porColumna[col] ? " " : "") + it.texto;
        }
        return porColumna;
      })
      .filter((f) => f.nro !== "Nro." && f.paciente !== "Paciente" && f.concepto !== "Detalle Concepto" && !f.nro.includes("Asor |"));

    for (const f of filasDeTexto) {
      const total = numeroDesde(f.total);
      const pendiente = numeroDesde(f.pendiente);
      const esAnclaDeFila = /^\d{5,8}$/.test(f.nro) && (total !== null || pendiente !== null);

      if (esAnclaDeFila) {
        if (filaActual) lineas.push(filaActual);
        filaActual = {
          nroPresupuesto: f.nro,
          paciente: f.paciente,
          nroDoc: f.tipoDoc.replace(/\D/g, "").length >= 6 ? f.tipoDoc.replace(/\D/g, "") : "",
          codigoPrestacion: f.cod || null,
          concepto: [f.detalle, f.concepto].filter(Boolean).join(" — ") || null,
          total: total ?? 0,
          pendiente: pendiente ?? 0,
        };
      } else if (filaActual) {
        if (f.paciente) filaActual.paciente = (filaActual.paciente + " " + f.paciente).trim();
        if (!filaActual.nroDoc) {
          const digitos = f.tipoDoc.replace(/\D/g, "");
          if (digitos.length >= 6) filaActual.nroDoc = digitos;
        }
        if (f.detalle || f.concepto) {
          const extra = [f.detalle, f.concepto].filter(Boolean).join(" ");
          filaActual.concepto = filaActual.concepto ? `${filaActual.concepto} ${extra}` : extra;
        }
      }
    }
  }
  if (filaActual) lineas.push(filaActual);

  return lineas;
}
