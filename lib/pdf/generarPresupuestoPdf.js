import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MARRON = [109, 60, 27];
const TAN_CLARO = [250, 245, 238];
const GRIS_TEXTO = [55, 65, 81];
const GRIS_CLARO = [156, 163, 175];

function formatoPesos(n) {
  return `$${Math.round(Number(n)).toLocaleString("es-AR")}`;
}

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Convierte el logo de /public a data URL para poder incrustarlo en el
// PDF — si por algo falla (ej. bloqueado por el navegador), el PDF se
// arma igual sin logo en vez de romperse.
async function obtenerLogoDataUrl() {
  try {
    const res = await fetch("/icon.png");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Arma el PDF del presupuesto dibujando texto y tablas directamente (en
// vez de sacarle una "foto" a la pantalla): queda más liviano, el texto
// es nítido y seleccionable, y no depende de que el navegador sepa
// renderizar los colores del diseño de la app.
export async function generarPresupuestoPdf(presupuesto, vigenciaHasta) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margen = 15;
  const anchoUtil = 210 - margen * 2;
  let y = 20;

  const logo = await obtenerLogoDataUrl();
  const xTexto = logo ? margen + 20 : margen;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margen, y - 3, 16, 16);
    } catch {
      // si el logo no es un formato que jsPDF pueda incrustar, se sigue sin él
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...MARRON);
  doc.text("Clínica Dental", xTexto, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text("Marianela Ramírez", xTexto, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...MARRON);
  doc.text("Presupuesto", 210 - margen, y + 1, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(`N.º ${presupuesto.numero}`, 210 - margen, y + 6, { align: "right" });
  doc.text(`Fecha: ${formatoFecha(presupuesto.fecha)}`, 210 - margen, y + 11, { align: "right" });

  y += 18;
  doc.setDrawColor(...MARRON);
  doc.setLineWidth(0.6);
  doc.line(margen, y, 210 - margen, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_CLARO);
  doc.text("PACIENTE", margen, y);
  doc.text("PROFESIONAL", margen + anchoUtil / 2, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(presupuesto.paciente || "—", margen, y);
  doc.text(presupuesto.profesional || "—", margen + anchoUtil / 2, y);

  let yPaciente = y;
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTO);
  if (presupuesto.pacienteDni) {
    yPaciente += 5;
    doc.text(`DNI: ${presupuesto.pacienteDni}`, margen, yPaciente);
  }
  if (presupuesto.pacienteCelular) {
    yPaciente += 5;
    doc.text(`Cel.: ${presupuesto.pacienteCelular}`, margen, yPaciente);
  }

  y = Math.max(yPaciente, y) + 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    head: [["Prestación", "Cantidad", "Precio", "Importe"]],
    body: presupuesto.prestaciones.map((p) => [p.prestacion, String(p.cantidad), p.tipoPrecio, formatoPesos(p.importe)]),
    theme: "plain",
    styles: { fontSize: 9.5, textColor: GRIS_TEXTO, cellPadding: { top: 2.2, bottom: 2.2, left: 0, right: 0 } },
    headStyles: { textColor: MARRON, fontStyle: "bold", lineWidth: { bottom: 0.5 }, lineColor: MARRON },
    bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: [229, 231, 235] },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "center", cellWidth: 25 },
      2: { halign: "center", cellWidth: 30 },
      3: { halign: "right", cellWidth: 32 },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  const anchoTotal = 65;
  doc.setFillColor(...TAN_CLARO);
  doc.roundedRect(210 - margen - anchoTotal, y, anchoTotal, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...MARRON);
  doc.text("Total", 210 - margen - anchoTotal + 4, y + 8);
  doc.text(formatoPesos(presupuesto.total), 210 - margen - 4, y + 8, { align: "right" });

  y += 18;

  if (presupuesto.modalidadPago) {
    const lineas = [
      `Modalidad: ${presupuesto.modalidadPago}${
        presupuesto.modalidadPago === "Financiado" ? ` — ${presupuesto.cantidadCuotas} cuotas` : ""
      }`,
    ];
    if (presupuesto.modalidadPago === "Financiado") {
      lineas.push(
        `Anticipo: ${formatoPesos(presupuesto.anticipo)}     Saldo a financiar: ${formatoPesos(presupuesto.saldo)}`
      );
    }
    const altoBloque = 8 + lineas.length * 5;
    doc.setDrawColor(...GRIS_CLARO);
    doc.setLineWidth(0.3);
    doc.roundedRect(margen, y, anchoUtil, altoBloque, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_CLARO);
    doc.text("CONDICIONES DE PAGO", margen + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRIS_TEXTO);
    lineas.forEach((linea, i) => doc.text(linea, margen + 4, y + 11 + i * 5));
    y += altoBloque + 8;
  }

  if (presupuesto.observaciones) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_CLARO);
    doc.text("OBSERVACIONES", margen, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRIS_TEXTO);
    const lineasObs = doc.splitTextToSize(presupuesto.observaciones, anchoUtil);
    doc.text(lineasObs, margen, y);
    y += lineasObs.length * 5 + 8;
  }

  const yFooter = Math.max(y + 15, 260);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(`Presupuesto válido hasta el ${formatoFecha(vigenciaHasta)}.`, margen, yFooter);

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(210 - margen - 60, yFooter - 3, 210 - margen, yFooter - 3);
  doc.setFontSize(8);
  doc.text("Firma del paciente", 210 - margen - 30, yFooter + 2, { align: "center" });

  return doc;
}
