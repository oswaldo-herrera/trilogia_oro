/* ===========================================================
   Panel privado · Galardón Trilogía de Oro
   Acceso: admin.html#k=LLAVE  (la llave se genera en supabase.sql)
   =========================================================== */

const TZ = "America/Mexico_City";
const REFRESCO_MS = 30000;

const $ = (sel) => document.querySelector(sel);
const gateView = $("#gateView");
const gateMsg = $("#gateMsg");
const panelView = $("#panelView");
const rowsEl = $("#rows");
const searchEl = $("#search");

let registros = [];
let filtro = "todos";

/* ---------- Llave de acceso ---------- */
function obtenerLlave() {
  const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  const deUrl = params.get("k");
  if (deUrl) {
    try { localStorage.setItem("gdo_llave", deUrl); } catch {}
    history.replaceState(null, "", location.pathname); // oculta la llave de la barra
    return deUrl;
  }
  try { return localStorage.getItem("gdo_llave"); } catch { return null; }
}

const LLAVE = obtenerLlave();

function denegar(msg) {
  try { localStorage.removeItem("gdo_llave"); } catch {}
  panelView.classList.add("hidden");
  gateView.classList.remove("hidden");
  gateMsg.textContent = msg;
}

/* ---------- Datos ---------- */
async function cargar() {
  const { data, error } = await sb.rpc("admin_listar", { p_llave: LLAVE });
  if (error) {
    if (error.code === "42501") return denegar("Enlace inválido. Usa el enlace privado completo.");
    console.error(error);
    $("#updated").textContent = "No se pudo actualizar. Reintentando…";
    return;
  }
  registros = data || [];
  gateView.classList.add("hidden");
  panelView.classList.remove("hidden");
  $("#updated").textContent = "Actualizado " + hora(new Date()) + " · se actualiza cada 30 s";
  render();
}

async function marcar(folio, asistio, btn) {
  btn.disabled = true;
  const { data, error } = await sb.rpc("admin_marcar", { p_llave: LLAVE, p_folio: folio, p_asistio: asistio });
  btn.disabled = false;
  if (error) {
    alert("No se pudo guardar la llegada. Revisa tu conexión.");
    return;
  }
  const i = registros.findIndex((r) => r.folio === folio);
  if (i >= 0) registros[i] = data;
  render();
}

/* ---------- Render ---------- */
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const hora = (d) => new Date(d).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fecha = (d) => new Date(d).toLocaleString("es-MX", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const telefono = (t) => String(t).replace(/(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");

function visibles() {
  const q = norm(searchEl.value.trim());
  const digitos = q.replace(/\D/g, "");

  let lista = registros.filter((r) =>
    filtro === "todos" ? true : filtro === "llegaron" ? r.asistio : !r.asistio
  );

  if (q) {
    lista = lista.filter((r) =>
      norm(r.nombre).includes(q) ||
      norm(r.correo).includes(q) ||
      (digitos && (String(r.folio).startsWith(digitos) || r.whatsapp.includes(digitos)))
    );
    // Folio exacto primero
    lista.sort((a, b) => (String(b.folio) === digitos) - (String(a.folio) === digitos) || a.folio - b.folio);
  }
  return lista;
}

function render() {
  const total = registros.length;
  const llegaron = registros.filter((r) => r.asistio).length;
  $("#sTotal").textContent = total;
  $("#sLlegaron").textContent = llegaron;
  $("#sPendientes").textContent = total - llegaron;

  const lista = visibles();
  $("#empty").classList.toggle("hidden", lista.length > 0);

  rowsEl.innerHTML = lista.map((r) => `
    <tr class="${r.asistio ? "arrived" : ""}">
      <td class="folio-cell">${r.folio}</td>
      <td class="name-cell">${esc(r.nombre)}</td>
      <td><a class="muted" href="https://wa.me/${r.whatsapp.length === 10 ? "52" + r.whatsapp : r.whatsapp}" target="_blank" rel="noopener">${telefono(r.whatsapp)}</a></td>
      <td class="muted">${esc(r.correo)}</td>
      <td class="muted date-cell">${fecha(r.created_at)}</td>
      <td class="action-cell">
        <button class="checkin ${r.asistio ? "done" : ""}" data-folio="${r.folio}">
          ${r.asistio ? "✓ Llegó " + hora(r.hora_llegada) : "Registrar llegada"}
        </button>
      </td>
    </tr>`).join("");
}

/* ---------- Eventos ---------- */
rowsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".checkin");
  if (!btn) return;
  const r = registros.find((x) => x.folio === Number(btn.dataset.folio));
  if (!r) return;
  if (r.asistio) {
    if (confirm(`¿Quitar la llegada de ${r.nombre} (folio ${r.folio})?`)) marcar(r.folio, false, btn);
  } else {
    marcar(r.folio, true, btn);
  }
});

searchEl.addEventListener("input", render);

// Enter en el buscador: si hay un solo resultado pendiente, registra su llegada
searchEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const lista = visibles();
  if (lista.length === 1 && !lista[0].asistio) {
    const btn = rowsEl.querySelector(".checkin");
    marcar(lista[0].folio, true, btn).then(() => searchEl.select());
  }
});

document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    filtro = chip.dataset.filter;
    render();
  })
);

$("#refreshBtn").addEventListener("click", cargar);
$("#xlsBtn").addEventListener("click", exportarExcel);
$("#pdfBtn").addEventListener("click", exportarPDF);

/* ---------- Exportar ---------- */
function nombreArchivo(ext) {
  const d = new Date().toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16).replace(/[: ]/g, "-");
  return `Registro-GalardonDeOro-${d}.${ext}`;
}

function exportarExcel() {
  const filas = registros.map((r) => ({
    Folio: r.folio,
    Nombre: r.nombre,
    WhatsApp: r.whatsapp,
    Correo: r.correo,
    "Fecha de registro": fecha(r.created_at),
    "Llegó": r.asistio ? "Sí" : "",
    "Hora de llegada": r.hora_llegada ? hora(r.hora_llegada) : "",
  }));
  const ws = XLSX.utils.json_to_sheet(filas);
  ws["!cols"] = [{ wch: 7 }, { wch: 34 }, { wch: 14 }, { wch: 32 }, { wch: 18 }, { wch: 7 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  XLSX.writeFile(wb, nombreArchivo("xlsx"));
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const llegaron = registros.filter((r) => r.asistio).length;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 26, 20);
  doc.text("Galardón Trilogía de Oro Internacional · Entrega 26", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 100, 85);
  doc.text(
    `Hacienda los Albos, Querétaro · 24/09/2026 18:00 hrs   |   Registrados: ${registros.length}   ·   Llegaron: ${llegaron}   ·   Generado: ${fecha(new Date())}`,
    14, 22
  );

  doc.autoTable({
    startY: 27,
    head: [["Folio", "Nombre", "WhatsApp", "Correo", "Llegó", "Hora"]],
    body: registros.map((r) => [
      r.folio, r.nombre, telefono(r.whatsapp), r.correo,
      r.asistio ? "Sí" : "", r.hora_llegada ? hora(r.hora_llegada) : "",
    ]),
    styles: { fontSize: 9, cellPadding: 2.4, textColor: [30, 26, 20], lineColor: [225, 215, 195], lineWidth: 0.1 },
    headStyles: { fillColor: [20, 17, 13], textColor: [243, 220, 155], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 247, 240] },
    columnStyles: {
      0: { cellWidth: 16, fontStyle: "bold", halign: "center" },
      2: { cellWidth: 30 },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
    },
    // Casilla vacía para palomear a mano si no hay internet en el evento
    didDrawCell: (d) => {
      if (d.section === "body" && d.column.index === 4 && !d.cell.raw) {
        const s = 3.6;
        doc.setDrawColor(120, 110, 95);
        doc.setLineWidth(0.3);
        doc.rect(d.cell.x + (d.cell.width - s) / 2, d.cell.y + (d.cell.height - s) / 2, s, s);
      }
    },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${doc.getNumberOfPages()}`, W - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    },
  });

  doc.save(nombreArchivo("pdf"));
}

/* ---------- Inicio ---------- */
if (!sb) {
  gateMsg.textContent = "Falta configurar Supabase en config.js.";
} else if (!LLAVE) {
  gateMsg.textContent = "Acceso restringido. Abre el panel con tu enlace privado.";
} else {
  cargar();
  setInterval(() => { if (!document.hidden) cargar(); }, REFRESCO_MS);
}
