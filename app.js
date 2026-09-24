/* ===========================================================
   Registro · Galardón Trilogía de Oro Internacional — Querétaro
   =========================================================== */

// La conexión a Supabase está en config.js.
// Si no hay credenciales, los folios se guardan solo en este navegador (modo prueba).
const FOLIO_INICIAL = 100;

const EVENTO = {
  nombre: "Galardón Trilogía de Oro Internacional",
  entrega: "Entrega 26",
  sede: "Hacienda los Albos",
  ciudad: "Querétaro",
  fecha: "24 · 09 · 2026",
  hora: "18:00 hrs",
};

const $ = (sel) => document.querySelector(sel);
const form = $("#regForm");
const submitBtn = $("#submitBtn");
const formMsg = $("#formMsg");
const formCard = $("#formCard");
const ticketCard = $("#ticketCard");

let registro = null; // { folio, nombre, whatsapp, correo }

/* ---------- Validación ---------- */
const reglas = {
  nombre: (v) => (v.trim().length >= 3 ? "" : "Escribe tu nombre completo."),
  whatsapp: (v) => (/^\d{10,13}$/.test(v.replace(/\D/g, "")) ? "" : "Ingresa un número válido (10 dígitos)."),
  correo: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Ingresa un correo válido."),
};

function validarCampo(input) {
  const msg = reglas[input.name](input.value);
  const field = input.closest(".field");
  field.classList.toggle("invalid", !!msg);
  field.querySelector(".error").textContent = msg;
  return !msg;
}

form.querySelectorAll("input").forEach((input) => {
  input.addEventListener("blur", () => validarCampo(input));
  input.addEventListener("input", () => {
    if (input.closest(".field").classList.contains("invalid")) validarCampo(input);
  });
});

/* ---------- Guardado y folio ---------- */
async function guardarRegistro(datos) {
  if (sb) {
    const { data, error } = await sb.rpc("registrar", {
      p_nombre: datos.nombre,
      p_whatsapp: datos.whatsapp,
      p_correo: datos.correo,
    });
    if (error) throw error;
    return data;
  }

  // Modo local (solo para pruebas: cada navegador lleva su propio contador)
  const lista = JSON.parse(localStorage.getItem("gdo_registros") || "[]");
  const existente = lista.find((r) => r.correo === datos.correo);
  if (existente) return existente.folio;

  const folio = FOLIO_INICIAL + lista.length;
  lista.push({ ...datos, folio, fecha: new Date().toISOString() });
  localStorage.setItem("gdo_registros", JSON.stringify(lista));
  return folio;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.textContent = "";

  const inputs = [...form.querySelectorAll("input")];
  const validos = inputs.map(validarCampo).every(Boolean);
  if (!validos) return;

  const datos = {
    nombre: form.nombre.value.trim().replace(/\s+/g, " "),
    whatsapp: form.whatsapp.value.replace(/\D/g, ""),
    correo: form.correo.value.trim().toLowerCase(),
  };

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");

  try {
    const folio = await guardarRegistro(datos);
    registro = { ...datos, folio };
    mostrarTicket();
  } catch (err) {
    console.error(err);
    formMsg.textContent = "Ocurrió un error al registrar. Intenta de nuevo.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("loading");
  }
});

function mostrarTicket() {
  $("#tName").textContent = registro.nombre;
  $("#tFolio").textContent = registro.folio;
  formCard.classList.add("hidden");
  ticketCard.classList.remove("hidden");
  ticketCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#newBtn").addEventListener("click", () => {
  registro = null;
  form.reset();
  ticketCard.classList.add("hidden");
  formCard.classList.remove("hidden");
  form.nombre.focus();
});

$("#downloadBtn").addEventListener("click", () => {
  if (registro) generarPDF(registro);
});

/* ---------- Invitación PDF ---------- */
function generarPDF({ nombre, folio }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a5" }); // 148 x 210
  const W = 148, H = 210, cx = W / 2;

  const GOLD = [212, 175, 95];
  const GOLD_LIGHT = [243, 220, 155];
  const MUTED = [163, 155, 140];
  const WHITE = [244, 239, 230];

  // Fondo
  doc.setFillColor(10, 9, 8);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(20, 17, 13);
  doc.rect(0, 0, W, 78, "F");

  // Marco doble
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.2);
  doc.rect(11, 11, W - 22, H - 22);

  const divisor = (y, ancho = 50) => {
    doc.setLineWidth(0.3);
    doc.line(cx - ancho / 2, y, cx - 3, y);
    doc.line(cx + 3, y, cx + ancho / 2, y);
    doc.setFillColor(...GOLD);
    doc.lines([[1.6, 1.6], [-1.6, 1.6], [-1.6, -1.6], [1.6, -1.6]], cx, y - 1.6, [1, 1], "F", true);
  };

  // Encabezado
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("I N V I T A C I Ó N", cx, 26, { align: "center" });

  doc.setFont("times", "bold");
  doc.setTextColor(...GOLD_LIGHT);
  doc.setFontSize(13);
  doc.text("GALARDÓN", cx, 38, { align: "center" });
  doc.setFontSize(24);
  doc.text("TRILOGÍA DE ORO", cx, 49, { align: "center" });
  doc.setFontSize(14);
  doc.text("INTERNACIONAL", cx, 57, { align: "center" });

  doc.setDrawColor(...GOLD);
  divisor(65);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("E N T R E G A   2 6", cx, 73, { align: "center" });

  // Invitado
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("SE COMPLACE EN INVITAR A", cx, 94, { align: "center" });

  doc.setFont("times", "bold");
  doc.setTextColor(...WHITE);
  let size = 22;
  doc.setFontSize(size);
  while (doc.getTextWidth(nombre) > W - 36 && size > 12) doc.setFontSize(--size);
  const lineas = doc.splitTextToSize(nombre, W - 36);
  doc.text(lineas, cx, 106, { align: "center" });

  // Folio
  const yFolio = 106 + (lineas.length - 1) * 8 + 14;
  doc.setDrawColor(...GOLD);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setLineWidth(0.25);
  doc.line(28, yFolio, W - 28, yFolio);
  doc.line(28, yFolio + 32, W - 28, yFolio + 32);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("F O L I O", cx, yFolio + 8, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(40);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text(String(folio), cx, yFolio + 25, { align: "center" });

  // Detalles
  const yDet = yFolio + 46;
  const cols = [
    ["FECHA", EVENTO.fecha],
    ["HORA", EVENTO.hora],
    ["SEDE", EVENTO.ciudad],
  ];
  const colW = (W - 36) / 3;
  cols.forEach(([label, valor], i) => {
    const x = 18 + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GOLD);
    doc.text(label, x, yDet, { align: "center" });
    doc.setFontSize(9.5);
    doc.setTextColor(...WHITE);
    doc.text(valor, x, yDet + 6, { align: "center" });
  });

  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text(EVENTO.sede, cx, yDet + 18, { align: "center" });

  // Pie
  divisor(H - 26, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text("Invitación personal e intransferible · Presentar al ingresar", cx, H - 18, { align: "center" });

  doc.save(`Invitacion-GalardonDeOro-Folio-${folio}.pdf`);
}
