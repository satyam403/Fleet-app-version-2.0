import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Inspection } from '../types';


export async function generateInspectionPDF(inspection: Inspection): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  // `page` is mutable: every time the cursor runs out of room we point it at
  // the freshly-added page. Previous version kept drawing on page 1 forever
  // — items disappeared off the bottom on long inspections.
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = height - 50;
  const leftMargin = 50;
  const lineHeight = 20;

  // Title
  page.drawText('DOT INSPECTION REPORT', {
    x: leftMargin,
    y: yPosition,
    size: 20,
    font: fontBold,
    color: rgb(0, 0.2, 0.5),
  });

  yPosition -= 40;

  // Company Info
  page.drawText('FleetOps - Fleet Management System', {
    x: leftMargin,
    y: yPosition,
    size: 12,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });

  yPosition -= 30;

  // Inspection Details
  const details = [
    `Inspection ID: ${inspection.id}`,
    `Date: ${new Date(inspection.date).toLocaleDateString()}`,
    `Trailer: ${inspection.trailerNumber}`,
    `Technician: ${inspection.technicianName}`,
  ];

  details.forEach(detail => {
    page.drawText(detail, {
      x: leftMargin,
      y: yPosition,
      size: 11,
      font: font,
    });
    yPosition -= lineHeight;
  });

  yPosition -= 20;

  // Checklist Header
  page.drawText('INSPECTION CHECKLIST', {
    x: leftMargin,
    y: yPosition,
    size: 14,
    font: fontBold,
    color: rgb(0, 0.2, 0.5),
  });

  yPosition -= 25;

  // Checklist Items
  inspection.checklist.forEach(item => {
    if (yPosition < 100) {
      // Out of room — add a new page and keep drawing on it.
      page = pdfDoc.addPage([612, 792]);
      yPosition = page.getSize().height - 50;
    }

    const statusColor =
      item.status === 'pass' ? rgb(0, 0.6, 0) :
      item.status === 'fail' ? rgb(0.8, 0, 0) :
      rgb(0.5, 0.5, 0.5);

    page.drawText(`• ${item.label}`, {
      x: leftMargin,
      y: yPosition,
      size: 10,
      font: fontBold,
    });

    page.drawText(`Status: ${item.status.toUpperCase()}`, {
      x: leftMargin + 250,
      y: yPosition,
      size: 10,
      font: font,
      color: statusColor,
    });

    yPosition -= 15;

    if (item.comments) {
      page.drawText(`  Notes: ${item.comments}`, {
        x: leftMargin + 10,
        y: yPosition,
        size: 9,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 20;
    } else {
      yPosition -= 10;
    }
  });

  yPosition -= 30;

  // Signature Section — same overflow rule.
  if (yPosition < 150) {
    page = pdfDoc.addPage([612, 792]);
    yPosition = page.getSize().height - 50;
  }

  page.drawText('SIGNATURE', {
    x: leftMargin,
    y: yPosition,
    size: 12,
    font: fontBold,
  });

  yPosition -= 30;

  page.drawLine({
    start: { x: leftMargin, y: yPosition },
    end: { x: leftMargin + 200, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  page.drawText('Technician Signature', {
    x: leftMargin,
    y: yPosition - 15,
    size: 9,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();

  // Create a clean ArrayBuffer manually
  const arrayBuffer = new ArrayBuffer(pdfBytes.length);
  const view = new Uint8Array(arrayBuffer);
  view.set(pdfBytes);

  return new Blob([arrayBuffer], {
    type: 'application/pdf',
  });
}



/* ══════════════════════════════════════════════
   TYPE
══════════════════════════════════════════════ */
export interface WorkOrder {
  id: string;
  woNumber: string;
  trailerId: string;
  trailerNumber: string;
  technicianName: string;
  date: string;
  issueNotes: string;
  status: string;
  grandTotal?: number;          // ✅ added
  items: {
    itemName: string;
    quantity: number;
    pricePerPart?: number;      // ✅ added
    lineTotal?: number;         // ✅ added
  }[];
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function fmt(n?: number) {
  return `$${(n ?? 0).toFixed(2)}`;
}

/* ══════════════════════════════════════════════
   GENERATOR
══════════════════════════════════════════════ */
export async function generateWorkOrderPDF(workOrder: WorkOrder): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth  = 612;
  const pageHeight = 792;
  const margin     = 50;
  const lineHeight = 18;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y    = pageHeight - margin;

  const ensureSpace = (required = 40) => {
    if (y < required) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y    = pageHeight - margin;
    }
  };

  const drawText = (
    text: string,
    size  = 11,
    bold  = false,
    color = rgb(0, 0, 0),
    x     = margin,
  ) => {
    ensureSpace();
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
    y -= lineHeight;
  };

  const drawWrappedText = (text: string, size = 10, maxWidth = 480) => {
    const words = text.split(' ');
    let line = '';
    words.forEach(word => {
      const testLine = line + word + ' ';
      if (font.widthOfTextAtSize(testLine, size) > maxWidth) {
        drawText(line.trim(), size);
        line = word + ' ';
      } else {
        line = testLine;
      }
    });
    if (line.trim()) drawText(line.trim(), size);
  };

  /* ─── TITLE ─── */
  page.drawText('WORK ORDER', { x: margin, y, size: 20, font: fontBold, color: rgb(0, 0.2, 0.6) });
  y -= 35;
  drawText('FleetOps - Fleet Management System', 12, false, rgb(0.4, 0.4, 0.4));
  y -= 10;

  /* ─── DETAILS ─── */
  const details = [
    `Work Order #: ${workOrder.woNumber}`,
    `Date: ${new Date(workOrder.date).toLocaleDateString()}`,
    `Trailer: ${workOrder.trailerNumber}`,
    `Technician: ${workOrder.technicianName}`,
    `Status: ${workOrder.status.toUpperCase()}`,
  ];
  details.forEach(d => drawText(d));
  y -= 10;

  /* ─── ISSUE DESCRIPTION ─── */
  drawText('ISSUE DESCRIPTION', 14, true, rgb(0, 0.2, 0.6));
  y -= 5;
  drawWrappedText(workOrder.issueNotes || 'N/A');
  y -= 10;

  /* ─── PARTS TABLE ─── */
  drawText('PARTS & MATERIALS USED', 14, true, rgb(0, 0.2, 0.6));
  y -= 5;

  ensureSpace(100);

  // ✅ Table columns
  const colItem  = margin;
  const colQty   = margin + 260;
  const colPrice = margin + 340;
  const colTotal = margin + 420;

  // Header row
  const headerY = y;
  page.drawRectangle({ x: margin - 4, y: headerY - 4, width: pageWidth - margin * 2 + 8, height: 20, color: rgb(0.9, 0.93, 1) });
  page.drawText('Item Name',   { x: colItem,  y: headerY, size: 10, font: fontBold });
  page.drawText('Qty',         { x: colQty,   y: headerY, size: 10, font: fontBold });
  page.drawText('Unit Price',  { x: colPrice, y: headerY, size: 10, font: fontBold });
  page.drawText('Line Total',  { x: colTotal, y: headerY, size: 10, font: fontBold });
  y -= lineHeight + 2;

  // Data rows
  workOrder.items.forEach((item, idx) => {
    ensureSpace();

    // Alternating row background
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin - 4, y: y - 4, width: pageWidth - margin * 2 + 8, height: 18, color: rgb(0.97, 0.97, 0.97) });
    }

    const name = item.itemName.length > 32 ? item.itemName.slice(0, 30) + '…' : item.itemName;
    page.drawText(name,                         { x: colItem,  y, size: 10, font });
    page.drawText(item.quantity.toString(),      { x: colQty,   y, size: 10, font });
    page.drawText(fmt(item.pricePerPart),        { x: colPrice, y, size: 10, font });  // ✅ unit price
    page.drawText(fmt(item.lineTotal),           { x: colTotal, y, size: 10, font });  // ✅ line total
    y -= lineHeight;
  });

  // ✅ Grand Total row
  if (workOrder.items.length > 0) {
    y -= 6;
    ensureSpace(30);
    page.drawLine({ start: { x: margin, y: y + 14 }, end: { x: pageWidth - margin, y: y + 14 }, thickness: 0.8, color: rgb(0.7, 0.7, 0.7) });
    page.drawText('GRAND TOTAL', { x: colPrice - 60, y, size: 11, font: fontBold, color: rgb(0, 0.2, 0.6) });
    page.drawText(fmt(workOrder.grandTotal),     { x: colTotal, y, size: 11, font: fontBold, color: rgb(0, 0.2, 0.6) });  // ✅ grand total
    y -= lineHeight + 8;
  }

  y -= 10;

  /* ─── SIGNATURES ─── */
  ensureSpace(120);
  drawText('SIGNATURES', 12, true);
  y -= 20;

  page.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 1 });
  page.drawText('Technician Signature', { x: margin, y: y - 15, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  page.drawLine({ start: { x: pageWidth - margin - 200, y }, end: { x: pageWidth - margin, y }, thickness: 1 });
  page.drawText('Supervisor Signature', { x: pageWidth - margin - 200, y: y - 15, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  /* ─── SAVE ─── */
  const pdfBytes    = await pdfDoc.save();
  const arrayBuffer = new ArrayBuffer(pdfBytes.length);
  const view        = new Uint8Array(arrayBuffer);
  view.set(pdfBytes);

  return new Blob([arrayBuffer], { type: 'application/pdf' });
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================
//  reportPdfGenerator.ts
//  ✅ Reusable PDF/Print generator — tu apna template paste kar dena
//  ✅ Inventory full report with vendor + cost breakdown
// =============================================================

/* ─────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────── */
export interface ReportMeta {
  title: string;           // "Inventory Usage Report"
  subtitle?: string;       // "March 2025 · Grouped by Vendor"
  generatedBy?: string;    // user name
  companyName?: string;    // "Handa Transportation"
  logo?: string;           // base64 or URL (optional)
  period?: string;         // "March 2025"
}

export interface ReportTable {
  heading: string;
  columns: { label: string; key: string; align?: "left" | "right" | "center"; mono?: boolean; bold?: boolean; width?: string }[];
  rows: Record<string, any>[];
  totalRow?: Record<string, any>;  // optional footer row
}

export interface ReportSummaryCard {
  label: string;
  value: string;
  sub?: string;
  color?: string;  // hex
}

export interface ReportSection {
  heading?: string;
  summaryCards?: ReportSummaryCard[];
  tables?: ReportTable[];
  notes?: string;
}

export interface ReportData {
  meta: ReportMeta;
  sections: ReportSection[];
}

/* ─────────────────────────────────────────────────
   MAIN PDF GENERATOR FUNCTION
   Renders the report HTML into a hidden A4-width iframe and
   exports it as a real, downloadable PDF via html2pdf — this
   works reliably on mobile (the old window.open + print() path
   was blocked by mobile pop-up blockers and never produced a
   clean PDF on phones). Falls back to the print window only if
   html2pdf can't be loaded (e.g. offline).
───────────────────────────────────────────────── */
function sanitizeFilename(s: string): string {
  return (s || "Report").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 80);
}

function loadHtml2Pdf(win: Window): Promise<any> {
  const w = win as any;
  if (w.html2pdf) return Promise.resolve(w.html2pdf);
  return new Promise((resolve, reject) => {
    const s = win.document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.onload = () => resolve(w.html2pdf);
    s.onerror = () => reject(new Error("html2pdf load failed"));
    win.document.head.appendChild(s);
  });
}

async function downloadHtmlAsPdf(html: string, filename: string): Promise<void> {
  // Hidden iframe at A4 CSS pixel width (794px @ 96dpi) so the report's own
  // fonts/CSS apply in isolation before we rasterize it.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);
  try {
    const idoc = iframe.contentDocument!;
    idoc.open();
    idoc.write(html);
    idoc.close();

    // Give fonts + layout time to settle.
    await new Promise((r) => setTimeout(r, 500));
    const fonts = (idoc as any).fonts;
    if (fonts?.ready) { try { await fonts.ready; } catch { /* ignore */ } }

    const html2pdf = await loadHtml2Pdf(iframe.contentWindow as Window);
    await html2pdf()
      .set({
        margin: [8, 8, 10, 8],
        filename,
        image: { type: "jpeg", quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".section", ".stat-card", "tr", ".vcard"] },
      })
      .from(idoc.body)
      .save();
  } finally {
    setTimeout(() => iframe.remove(), 1500);
  }
}

export function generatePdfReport(data: ReportData): void {
  const html = buildHtml(data);
  const filename =
    sanitizeFilename(data.meta?.title || "Report") +
    (data.meta?.period ? "_" + sanitizeFilename(data.meta.period) : "") +
    ".pdf";

  downloadHtmlAsPdf(html, filename).catch(() => {
    // Fallback (mainly desktop / offline): open a print window.
    const win = window.open("", "_blank", "width=1000,height=750");
    if (!win) {
      alert("Could not generate the PDF. Please allow pop-ups and try again.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 800);
  });
}

/* ─────────────────────────────────────────────────
   HTML BUILDER — YAHAN APNA TEMPLATE PASTE KAR
   Ye default template hai, tu isko replace kar dena
───────────────────────────────────────────────── */
function buildHtml(data: ReportData): string {
  const { meta, sections } = data;

  const summaryCardsHtml = (cards: ReportSummaryCard[]) => cards.map(c => `
    <div class="stat-card" ${c.color ? `style="border-top: 3px solid ${c.color};"` : ""}>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value" ${c.color ? `style="color:${c.color}"` : ""}>${c.value}</div>
      ${c.sub ? `<div class="stat-sub">${c.sub}</div>` : ""}
    </div>
  `).join("");

  const tableHtml = (table: ReportTable) => {
    const colsHtml = table.columns.map(c => `<th style="text-align:${c.align || "left"};${c.width ? `width:${c.width};` : ""}">${c.label}</th>`).join("");
    const rowsHtml = table.rows.map(row => `
      <tr>
        ${table.columns.map(c => {
          const val = row[c.key] ?? "—";
          const style = `text-align:${c.align || "left"};${c.mono ? "font-family:'Courier New',monospace;font-size:11px;" : ""}${c.bold ? "font-weight:700;" : ""}`;
          return `<td style="${style}">${val}</td>`;
        }).join("")}
      </tr>
    `).join("");

    const totalRowHtml = table.totalRow ? `
      <tr class="total-row">
        ${table.columns.map(c => {
          const val = table.totalRow![c.key] ?? "";
          return `<td style="text-align:${c.align || "left"};font-weight:700;">${val}</td>`;
        }).join("")}
      </tr>
    ` : "";

    return `
      <div class="table-section">
        ${table.heading ? `<div class="table-heading">${table.heading}</div>` : ""}
        <table>
          <thead><tr>${colsHtml}</tr></thead>
          <tbody>${rowsHtml}${totalRowHtml}</tbody>
        </table>
      </div>
    `;
  };

  const sectionsHtml = sections.map(sec => `
    <div class="section">
      ${sec.heading ? `<div class="section-heading">${sec.heading}</div>` : ""}
      ${sec.summaryCards?.length ? `<div class="stat-grid">${summaryCardsHtml(sec.summaryCards)}</div>` : ""}
      ${sec.tables?.map(tableHtml).join("") || ""}
      ${sec.notes ? `<div class="notes">${sec.notes}</div>` : ""}
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${meta.title}</title>
  <style>
    /* ── FONTS ── */
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=DM+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');

    /* ── RESET ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── PAGE ── */
    @page {
      size: A4;
      margin: 16mm 14mm 18mm 14mm;
    }
    body {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.5;
      padding: 24px 28px;
    }

    /* ══════════════════════════════════════
       ── HEADER — TU YAHAN APNA TEMPLATE PASTE KAR
       ══════════════════════════════════════ */
    .report-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 16px;
      margin-bottom: 20px;
      border-bottom: 2.5px solid #1e40af;
    }
    .report-header-left {}
    .report-company {
      font-size: 11px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 4px;
    }
    .report-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .report-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .report-header-right {
      text-align: right;
      font-size: 11px;
      color: #64748b;
      line-height: 1.7;
    }
    .report-header-right strong {
      color: #0f172a;
      font-weight: 700;
    }

    /* ── SECTIONS ── */
    .section {
      margin-bottom: 24px;
      break-inside: avoid;
    }
    .section-heading {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: .06em;
      padding: 8px 0 8px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 12px;
    }

    /* ── STAT CARDS ── */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 11px 14px;
      background: #f8fafc;
    }
    .stat-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .07em;
      color: #64748b;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      font-family: 'IBM Plex Mono', monospace;
      line-height: 1;
    }
    .stat-sub {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* ── TABLES ── */
    .table-section {
      margin-bottom: 16px;
      break-inside: avoid;
    }
    .table-heading {
      font-size: 11px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: 7px;
      padding-left: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    thead tr {
      background: #1e40af;
    }
    thead th {
      padding: 8px 11px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #ffffff;
      border: none;
    }
    tbody tr {
      border-bottom: 1px solid #f1f5f9;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    tbody tr:hover {
      background: #eff6ff;
    }
    tbody td {
      padding: 9px 11px;
      color: #334155;
      border: none;
    }
    .total-row td {
      background: #eff6ff !important;
      border-top: 2px solid #bfdbfe !important;
      color: #1e40af;
      font-size: 12px;
    }

    /* ── NOTES ── */
    .notes {
      font-size: 11px;
      color: #64748b;
      background: #f8fafc;
      border-left: 3px solid #bfdbfe;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin-top: 10px;
      line-height: 1.6;
    }

    /* ── FOOTER ── */
    .report-footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }

    /* ── PRINT ── */
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- ════════════════════════════════════
       HEADER — TU APNA LOGO/TEMPLATE YAHAN PASTE KAR
       ════════════════════════════════════ -->
  <div class="report-header">
    <div class="report-header-left">
      ${meta.companyName ? `<div class="report-company">${meta.companyName}</div>` : ""}
      <div class="report-title">${meta.title}</div>
      ${meta.subtitle ? `<div class="report-subtitle">${meta.subtitle}</div>` : ""}
    </div>
    <div class="report-header-right">
      <div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
      <div><strong>Time:</strong> ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
      ${meta.period ? `<div><strong>Period:</strong> ${meta.period}</div>` : ""}
      ${meta.generatedBy ? `<div><strong>By:</strong> ${meta.generatedBy}</div>` : ""}
    </div>
  </div>

  <!-- SECTIONS -->
  ${sectionsHtml}

  <!-- FOOTER -->
  <div class="report-footer">
    <span>${meta.companyName || "Fleet Management System"} · Confidential</span>
    <span>${meta.title} · ${meta.period || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
  </div>

</body>
</html>
  `;
}

/* ─────────────────────────────────────────────────────
   INVENTORY REPORT PDF BUILDER
   Call: buildInventoryReportPdf(report, period, groupBy, userName)
───────────────────────────────────────────────────── */
export function buildInventoryReportPdf(
  report: {
    summary: { totalCost: number; totalUnits: number; totalWOs: number; lineCount: number };
    grouped: { key: string; totalQty: number; totalCost: number; rows: any[] }[];
  },
  period: string,
  groupBy: string,
  userName?: string
): void {
  if (!report) return;

  const allRows = report.grouped.flatMap(g => g.rows || []);
  const fmtCurrency = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Grouped summary table
  const groupedRows = report.grouped.map(g => ({
    key:      g.key || "—",
    totalQty: String(g.totalQty),
    totalCost: fmtCurrency(g.totalCost),
    pct:      `${((g.totalCost / (report.summary.totalCost || 1)) * 100).toFixed(1)}%`,
    wos:      String(new Set(g.rows.map((r: any) => r.woNumber)).size),
  }));

  // All transactions table
  const transactionRows = allRows
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((r: any) => ({
      date:        fmtDate(r.date),
      usedBy:      r.completedBy || r.vendor || "—",
      vendor:      r.vendor || "—",
      partName:    r.partName || "—",
      partNumber:  r.partNumber || "—",
      woNumber:    r.woNumber || "—",
      assetNumber: r.assetNumber || "—",
      qty:         String(r.qty),
      unitPrice:   fmtCurrency(r.pricePerPart),
      lineTotal:   fmtCurrency(r.lineTotal),
    }));

  const data: ReportData = {
    meta: {
      title:       "Inventory Usage Report",
      subtitle:    `${period} · Grouped by ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`,
      companyName: "Handa Transportation",
      period,
      generatedBy: userName,
    },
    sections: [
      // ── Section 1: Summary cards
      {
        heading: "Summary",
        summaryCards: [
          { label: "Total Cost",  value: fmtCurrency(report.summary.totalCost),  color: "#15803d" },
          { label: "Units Used",  value: String(report.summary.totalUnits),      color: "#1e40af" },
          { label: "Work Orders", value: String(report.summary.totalWOs),        color: "#6d28d9" },
          { label: "Line Items",  value: String(report.summary.lineCount),       color: "#b45309" },
        ],
      },

      // ── Section 2: Grouped by person/part/vendor/asset
      {
        heading: `Usage by ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`,
        tables: [{
          heading: `${report.grouped.length} groups`,
          columns: [
            { label: groupBy === "person" ? "Person" : groupBy === "part" ? "Part Name" : groupBy === "vendor" ? "Vendor" : "Asset #", key: "key", bold: true },
            { label: "Total Qty",  key: "totalQty",  align: "right", mono: true },
            { label: "Total Cost", key: "totalCost", align: "right", mono: true, bold: true },
            { label: "% of Total", key: "pct",       align: "right", mono: true },
            { label: "WOs",        key: "wos",       align: "right", mono: true },
          ],
          rows: groupedRows,
          totalRow: {
            key:      "GRAND TOTAL",
            totalQty:  String(report.summary.totalUnits),
            totalCost: fmtCurrency(report.summary.totalCost),
            pct:      "100%",
            wos:      String(report.summary.totalWOs),
          },
        }],
      },

      // ── Section 3: All transactions
      {
        heading: "All Transactions (Detailed)",
        tables: [{
          heading: `${transactionRows.length} records`,
          columns: [
            { label: "Date",       key: "date",        mono: true,  width: "80px" },
            { label: "Used By",    key: "usedBy",      bold: true,  width: "100px" },
            { label: "Vendor",     key: "vendor",                   width: "90px" },
            { label: "Part Name",  key: "partName",    bold: true },
            { label: "Part #",     key: "partNumber",  mono: true,  width: "80px" },
            { label: "WO #",       key: "woNumber",    mono: true,  width: "90px" },
            { label: "Asset",      key: "assetNumber", mono: true,  width: "70px" },
            { label: "Qty",        key: "qty",         align: "right", mono: true, width: "40px" },
            { label: "Unit $",     key: "unitPrice",   align: "right", mono: true, width: "65px" },
            { label: "Total",      key: "lineTotal",   align: "right", mono: true, bold: true, width: "70px" },
          ],
          rows: transactionRows,
          totalRow: {
            date:        "",
            usedBy:      "GRAND TOTAL",
            vendor:      "",
            partName:    "",
            partNumber:  "",
            woNumber:    `${new Set(allRows.map((r: any) => r.woNumber)).size} WOs`,
            assetNumber: "",
            qty:         String(report.summary.totalUnits),
            unitPrice:   "",
            lineTotal:   fmtCurrency(report.summary.totalCost),
          },
        }],
      },
    ],
  };

  generatePdfReport(data);
}

/* ─────────────────────────────────────────────────────
   WORK ORDER REPORT PDF BUILDER
───────────────────────────────────────────────────── */
export function buildWorkOrderReportPdf(
  workOrders: any[],
  period: string,
  userName?: string
): void {
  const fmtCurrency = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const total     = workOrders.length;
  const completed = workOrders.filter(w => (w.status || "").toLowerCase() === "completed").length;
  const pending   = workOrders.filter(w => ["pending","open"].includes((w.status || "").toLowerCase())).length;
  const inProg    = workOrders.filter(w => (w.status || "").toLowerCase() === "in_progress").length;
  const totalCost = workOrders.reduce((s, w) => s + (w.grand_total || 0), 0);

  const data: ReportData = {
    meta: {
      title:       "Work Order Report",
      subtitle:    period,
      companyName: "Handa Transportation",
      period,
      generatedBy: userName,
    },
    sections: [
      {
        heading: "Summary",
        summaryCards: [
          { label: "Total WOs",   value: String(total),             color: "#1e40af" },
          { label: "Completed",   value: String(completed),         color: "#15803d" },
          { label: "Pending",     value: String(pending),           color: "#b45309" },
          { label: "In Progress", value: String(inProg),            color: "#6d28d9" },
          { label: "Total Cost",  value: fmtCurrency(totalCost),    color: "#15803d", sub: "Grand total" },
        ],
      },
      {
        heading: "Work Order Details",
        tables: [{
          heading: `${total} records`,
          columns: [
            { label: "WO #",      key: "wo",       mono: true, bold: true, width: "90px" },
            { label: "Asset",     key: "asset",    mono: true, width: "70px" },
            { label: "Vendor",    key: "vendor",   bold: true, width: "100px" },
            { label: "Status",    key: "status",   width: "80px" },
            { label: "Priority",  key: "priority", width: "70px" },
            { label: "Issue",     key: "issue" },
            { label: "Start",     key: "start",    mono: true, width: "80px" },
            { label: "End",       key: "end",      mono: true, width: "80px" },
            { label: "Cost",      key: "cost",     align: "right", mono: true, bold: true, width: "70px" },
          ],
          rows: workOrders.map(wo => ({
            wo:       wo.work_order_number || "—",
            asset:    wo.asset_number || "—",
            vendor:   wo.vendor || "—",
            status:   wo.status || "—",
            priority: wo.priority || "—",
            issue:    (wo.issue_description || "—").slice(0, 60) + ((wo.issue_description || "").length > 60 ? "…" : ""),
            start:    fmtDate(wo.start_time),
            end:      wo.end_time ? fmtDate(wo.end_time) : "Open",
            cost:     fmtCurrency(wo.grand_total || 0),
          })),
          totalRow: {
            wo:       "TOTAL",
            asset:    "", vendor: "", status: "", priority: "", issue: "", start: "", end: "",
            cost:     fmtCurrency(totalCost),
          },
        }],
      },
    ],
  };

  generatePdfReport(data);
}

/* ─────────────────────────────────────────────────────
   INSPECTION REPORT PDF BUILDER
───────────────────────────────────────────────────── */
export function buildInspectionReportPdf(
  inspections: any[],
  period: string,
  userName?: string
): void {
  const fmtDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const total   = inspections.length;
  const passed  = inspections.filter(i => ["passed","pass"].includes((i.overall_status || "").toLowerCase())).length;
  const failed  = inspections.filter(i => ["failed","fail"].includes((i.overall_status || "").toLowerCase())).length;
  const dotC    = inspections.filter(i => (i._type || i.inspection_type || "").toLowerCase().includes("dot") || !i.inspector_name).length;
  const quickC  = total - dotC;
  const scores  = inspections.filter(i => i.inspection_score != null);
  const avgScore = scores.length ? (scores.reduce((s, i) => s + i.inspection_score, 0) / scores.length).toFixed(1) : "—";
  const passRate = total ? `${((passed / total) * 100).toFixed(1)}%` : "—";

  const data: ReportData = {
    meta: {
      title:       "Inspection Report",
      subtitle:    period,
      companyName: "Handa Transportation",
      period,
      generatedBy: userName,
    },
    sections: [
      {
        heading: "Summary",
        summaryCards: [
          { label: "Total",      value: String(total),    color: "#1e40af" },
          { label: "Passed",     value: String(passed),   color: "#15803d" },
          { label: "Failed",     value: String(failed),   color: "#b91c1c" },
          { label: "DOT",        value: String(dotC),     color: "#6d28d9" },
          { label: "Quick",      value: String(quickC),   color: "#b45309" },
          { label: "Avg Score",  value: avgScore === "—" ? "—" : `${avgScore}%`, color: "#1e40af" },
          { label: "Pass Rate",  value: passRate,          color: "#15803d" },
        ],
      },
      {
        heading: "Inspection Details",
        tables: [{
          heading: `${total} records`,
          columns: [
            { label: "Date",        key: "date",     mono: true, width: "80px" },
            { label: "Type",        key: "type",     width: "55px" },
            { label: "Insp #",      key: "inspNum",  mono: true, width: "90px" },
            { label: "Asset #",     key: "asset",    mono: true, bold: true, width: "70px" },
            { label: "Asset Type",  key: "assetType", width: "70px" },
            { label: "Inspector",   key: "inspector", bold: true, width: "100px" },
            { label: "Result",      key: "result",   width: "70px" },
            { label: "Score",       key: "score",    align: "right", mono: true, width: "55px" },
            { label: "Issues",      key: "issues",   align: "right", mono: true, width: "50px" },
            { label: "Defects",     key: "defects" },
          ],
          rows: inspections.map(i => ({
            date:       fmtDate(i.created_at),
            type:       i._type || (i.inspector_name ? "Quick" : "DOT"),
            inspNum:    i.inspection_number || i.inspection_id || "—",
            asset:      i.asset_number || "—",
            assetType:  i.asset_type || "—",
            inspector:  i.technician_name || i.inspector_name || "—",
            result:     (i.overall_status || "—").toUpperCase(),
            score:      i.inspection_score != null ? `${i.inspection_score}%` : "—",
            issues:     i.issue_count != null ? String(i.issue_count) : "—",
            defects:    ((i.defects_found || i.issues_found || "—")).slice(0, 60),
          })),
          totalRow: {
            date:      "",
            type:      "TOTALS",
            inspNum:   "",
            asset:     "",
            assetType: "",
            inspector: "",
            result:    `${passed} Pass / ${failed} Fail`,
            score:     avgScore === "—" ? "—" : `${avgScore}%`,
            issues:    "",
            defects:   `Pass Rate: ${passRate}`,
          },
        }],
      },
    ],
  };

  generatePdfReport(data);
}

/* ─────────────────────────────────────────────────────
   INVOICE REPORT PDF BUILDER
   Mirrors the workorder/inspection builders. Call:
     buildInvoiceReportPdf(invoices, period, userName)

   Replaces the old `window.print()` in the Invoice tab, which
   printed the entire browser chrome (header, nav, devtools).
───────────────────────────────────────────────────── */
export function buildInvoiceReportPdf(
  invoices: any[],
  period: string,
  userName?: string
): void {
  const fmtCurrency = (n: number) =>
    `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => {
    if (!s) return "—";
    const d = new Date(s);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const total        = invoices.length;
  const totalRevenue = invoices.reduce((s, i) => s + (i.grand_total     || 0), 0);
  const totalLabor   = invoices.reduce((s, i) => s + (i.labor_cost      || 0), 0);
  const totalParts   = invoices.reduce((s, i) => s + (i.parts_cost      || 0), 0);
  const totalTax     = invoices.reduce((s, i) => s + (i.sales_tax       || 0), 0);
  const totalCCFee   = invoices.reduce((s, i) => s + (i.credit_card_fee || 0), 0);
  const avgInvoice   = total > 0 ? totalRevenue / total : 0;

  const data: ReportData = {
    meta: {
      title:       "Invoice Report",
      subtitle:    period,
      companyName: "Handa Transportation",
      period,
      generatedBy: userName,
    },
    sections: [
      {
        heading: "Summary",
        summaryCards: [
          { label: "Invoices",    value: String(total),              color: "#1e40af" },
          { label: "Revenue",     value: fmtCurrency(totalRevenue),  color: "#15803d", sub: "Grand total" },
          { label: "Avg Invoice", value: fmtCurrency(avgInvoice),    color: "#0f766e" },
          { label: "Labor",       value: fmtCurrency(totalLabor),    color: "#6d28d9" },
          { label: "Parts",       value: fmtCurrency(totalParts),    color: "#b45309" },
          { label: "Tax",         value: fmtCurrency(totalTax),      color: "#b91c1c" },
          { label: "CC Fees",     value: fmtCurrency(totalCCFee),    color: "#0369a1" },
        ],
      },
      {
        heading: "Invoice Details",
        tables: [{
          heading: `${total} records`,
          columns: [
            { label: "Date",      key: "date",     mono: true, width: "80px" },
            { label: "Inv #",     key: "inv",      mono: true, bold: true, width: "90px" },
            { label: "Customer",  key: "customer", bold: true, width: "120px" },
            { label: "Vendor",    key: "vendor",   width: "100px" },
            { label: "Payment",   key: "payment",  width: "80px" },
            { label: "Labor",     key: "labor",    align: "right", mono: true, width: "70px" },
            { label: "Parts",     key: "parts",    align: "right", mono: true, width: "70px" },
            { label: "Tax",       key: "tax",      align: "right", mono: true, width: "60px" },
            { label: "Total",     key: "total",    align: "right", mono: true, bold: true, width: "80px" },
          ],
          rows: invoices.map(inv => ({
            date:     fmtDate(inv.created_at),
            inv:      inv.invoice_number || "—",
            customer: inv.owner_name     || "—",
            vendor:   inv.vendor || inv.mechanic || "—",
            payment:  inv.payment_type   || "—",
            labor:    fmtCurrency(inv.labor_cost),
            parts:    fmtCurrency(inv.parts_cost),
            tax:      fmtCurrency(inv.sales_tax),
            total:    fmtCurrency(inv.grand_total),
          })),
          totalRow: {
            date:     "TOTAL",
            inv:      "", customer: "", vendor: "", payment: "",
            labor:    fmtCurrency(totalLabor),
            parts:    fmtCurrency(totalParts),
            tax:      fmtCurrency(totalTax),
            total:    fmtCurrency(totalRevenue),
          },
        }],
      },
    ],
  };

  generatePdfReport(data);
}

/* ═════════════════════════════════════════════════════
   INVENTORY UPDATES (AUDIT) REPORT
   Two outputs from the same log data:
     1. buildInventoryUpdatesReportPdf → browser print / Save-as-PDF
     2. generateInventoryUpdatesPdfBlob → real Blob, used as the EmailJS
        attachment that gets mailed to satyam@handatransportation.com
═════════════════════════════════════════════════════ */

export interface InventoryUpdateLogRow {
  partName: string;
  partNumber: string;
  action: 'update' | 'add';
  previousQty: number;
  newQty: number;
  change: number;
  updatedBy: string;
  updatedAt: string;
  note: string;
}

function invUpdatesReportData(
  logs: InventoryUpdateLogRow[],
  period: string,
  userName?: string,
): ReportData {
  const fmtDateTime = (s: string) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalChanges = logs.length;
  const adds = logs.filter(l => l.action === 'add').length;
  const updates = totalChanges - adds;
  const people = new Set(logs.map(l => l.updatedBy).filter(Boolean)).size;
  const unitsAdded = logs.reduce((s, l) => s + Math.max(l.change, 0), 0);
  const unitsRemoved = logs.reduce((s, l) => s + Math.max(-l.change, 0), 0);

  // Per-person rollup
  const byPerson: Record<string, { name: string; count: number; net: number }> = {};
  logs.forEach(l => {
    const k = l.updatedBy || 'Unknown';
    if (!byPerson[k]) byPerson[k] = { name: k, count: 0, net: 0 };
    byPerson[k].count += 1;
    byPerson[k].net += l.change;
  });

  return {
    meta: {
      title:       'Inventory Update Report',
      subtitle:    period,
      companyName: 'Handa Transportation',
      period,
      generatedBy: userName,
    },
    sections: [
      {
        heading: 'Summary',
        summaryCards: [
          { label: 'Total Changes', value: String(totalChanges), color: '#1e40af' },
          { label: 'Quantity Updates', value: String(updates), color: '#6d28d9' },
          { label: 'New Parts', value: String(adds), color: '#15803d' },
          { label: 'People', value: String(people), color: '#0f766e' },
          { label: 'Units Added', value: `+${unitsAdded}`, color: '#15803d' },
          { label: 'Units Removed', value: `-${unitsRemoved}`, color: '#b91c1c' },
        ],
      },
      {
        heading: 'Changes by Person',
        tables: [{
          heading: `${Object.keys(byPerson).length} people`,
          columns: [
            { label: 'Updated By', key: 'name', bold: true },
            { label: 'Changes',    key: 'count', align: 'right', mono: true },
            { label: 'Net Qty',    key: 'net',   align: 'right', mono: true, bold: true },
          ],
          rows: Object.values(byPerson)
            .sort((a, b) => b.count - a.count)
            .map(p => ({ name: p.name, count: String(p.count), net: (p.net >= 0 ? '+' : '') + p.net })),
        }],
      },
      {
        heading: 'All Updates (Detailed)',
        tables: [{
          heading: `${totalChanges} records`,
          columns: [
            { label: 'Date / Time', key: 'date',   mono: true, width: '120px' },
            { label: 'Part Name',   key: 'part',   bold: true },
            { label: 'Part #',      key: 'pno',    mono: true, width: '90px' },
            { label: 'Action',      key: 'action', width: '60px' },
            { label: 'Prev',        key: 'prev',   align: 'right', mono: true, width: '50px' },
            { label: 'New',         key: 'newq',   align: 'right', mono: true, bold: true, width: '50px' },
            { label: 'Change',      key: 'chg',    align: 'right', mono: true, width: '60px' },
            { label: 'By',          key: 'by',     bold: true, width: '100px' },
            { label: 'Note',        key: 'note' },
          ],
          rows: logs
            .slice()
            .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
            .map(l => ({
              date:   fmtDateTime(l.updatedAt),
              part:   l.partName || '—',
              pno:    l.partNumber || '—',
              action: l.action === 'add' ? 'Added' : 'Update',
              prev:   String(l.previousQty),
              newq:   String(l.newQty),
              chg:    (l.change >= 0 ? '+' : '') + l.change,
              by:     l.updatedBy || '—',
              note:   l.note || '—',
            })),
        }],
      },
    ],
  };
}

/** Opens the browser print dialog with a styled Inventory Update report. */
export function buildInventoryUpdatesReportPdf(
  logs: InventoryUpdateLogRow[],
  period: string,
  userName?: string,
): void {
  generatePdfReport(invUpdatesReportData(logs, period, userName));
}

/** Renders the same report into a real PDF Blob (pdf-lib) for emailing. */
export async function generateInventoryUpdatesPdfBlob(
  logs: InventoryUpdateLogRow[],
  period: string,
  userName?: string,
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Landscape Letter — the detail table is wide.
  const pageWidth  = 792;
  const pageHeight = 612;
  const margin     = 36;
  const lineHeight = 15;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y    = pageHeight - margin;

  const navy = rgb(0.118, 0.251, 0.686);
  const grey = rgb(0.4, 0.4, 0.4);

  const ensure = (req = 24) => {
    if (y < margin + req) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
  const fmtDateTime = (s: string) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // ── Header ──
  page.drawText('INVENTORY UPDATE REPORT', { x: margin, y, size: 18, font: fontBold, color: navy });
  y -= 22;
  page.drawText('Handa Transportation', { x: margin, y, size: 11, font, color: grey });
  page.drawText(`Generated: ${new Date().toLocaleString('en-US')}`, { x: pageWidth - margin - 220, y, size: 9, font, color: grey });
  y -= 14;
  page.drawText(`Period: ${period}${userName ? `   ·   By: ${userName}` : ''}`, { x: margin, y, size: 9, font, color: grey });
  y -= 22;

  // ── Summary line ──
  const adds = logs.filter(l => l.action === 'add').length;
  const unitsAdded = logs.reduce((s, l) => s + Math.max(l.change, 0), 0);
  const unitsRemoved = logs.reduce((s, l) => s + Math.max(-l.change, 0), 0);
  const people = new Set(logs.map(l => l.updatedBy).filter(Boolean)).size;
  page.drawText(
    `Total changes: ${logs.length}   |   New parts: ${adds}   |   People: ${people}   |   Units +${unitsAdded} / -${unitsRemoved}`,
    { x: margin, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) },
  );
  y -= 22;

  // ── Table columns (x offsets) ──
  const cols = [
    { key: 'date',   label: 'Date / Time', x: margin },
    { key: 'part',   label: 'Part Name',   x: margin + 115 },
    { key: 'pno',    label: 'Part #',      x: margin + 255 },
    { key: 'action', label: 'Action',      x: margin + 320 },
    { key: 'prev',   label: 'Prev',        x: margin + 375 },
    { key: 'newq',   label: 'New',         x: margin + 415 },
    { key: 'chg',    label: 'Change',      x: margin + 455 },
    { key: 'by',     label: 'By',          x: margin + 510 },
    { key: 'note',   label: 'Note',        x: margin + 600 },
  ] as const;

  const drawHeaderRow = () => {
    page.drawRectangle({ x: margin - 4, y: y - 4, width: pageWidth - margin * 2 + 8, height: 18, color: rgb(0.118, 0.251, 0.686) });
    cols.forEach(c => page.drawText(c.label, { x: c.x, y, size: 8, font: fontBold, color: rgb(1, 1, 1) }));
    y -= lineHeight + 3;
  };

  drawHeaderRow();

  const sorted = logs.slice().sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  sorted.forEach((l, idx) => {
    ensure(18);
    if (y === pageHeight - margin) drawHeaderRow(); // fresh page → repeat header
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin - 4, y: y - 3, width: pageWidth - margin * 2 + 8, height: 14, color: rgb(0.96, 0.97, 0.99) });
    }
    const chg = (l.change >= 0 ? '+' : '') + l.change;
    const chgColor = l.change > 0 ? rgb(0.08, 0.5, 0.24) : l.change < 0 ? rgb(0.72, 0.11, 0.11) : grey;
    const row: Record<string, { text: string; color?: any }> = {
      date:   { text: fmtDateTime(l.updatedAt) },
      part:   { text: clip(l.partName || '—', 28) },
      pno:    { text: clip(l.partNumber || '—', 13) },
      action: { text: l.action === 'add' ? 'Added' : 'Update' },
      prev:   { text: String(l.previousQty) },
      newq:   { text: String(l.newQty) },
      chg:    { text: chg, color: chgColor },
      by:     { text: clip(l.updatedBy || '—', 16) },
      note:   { text: clip(l.note || '—', 24) },
    };
    cols.forEach(c => {
      const cell = row[c.key];
      page.drawText(cell.text, { x: c.x, y, size: 8, font, color: cell.color ?? rgb(0.2, 0.2, 0.2) });
    });
    y -= lineHeight;
  });

  if (sorted.length === 0) {
    page.drawText('No inventory updates recorded for this period.', { x: margin, y, size: 10, font, color: grey });
  }

  const bytes = await pdfDoc.save();
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf], { type: 'application/pdf' });
}

/** Base64 (no data: prefix) — EmailJS attachments want the raw base64 string. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:application/pdf;base64,"
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}