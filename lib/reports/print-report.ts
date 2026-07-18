import { format } from "date-fns";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";

export interface PrintReportConfig {
  title: string;
  subtitle?: string;
  period?: string;
  filters?: Record<string, string>;
  headers: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
  groupBy?: {
    key: number;
    label: string;
    subHeaders?: string[];
    subRows?: (string | number)[][];
    subTotals?: (string | number)[];
  }[];
  summary?: Record<string, string | number>;
}

function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) || 0 : value || 0;
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

function buildTableHtml(headers: string[], rows: (string | number)[][]): string {
  const headerRow = headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${typeof cell === "number" ? currency(cell) : escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

export function printReport(config: PrintReportConfig): void {
  const win = window.open("", "_blank", "width=1400,height=900");
  if (!win) {
    return;
  }

  const now = format(new Date(), "dd/MM/yyyy HH:mm:ss");
  const logoUrl = `${window.location.origin}${REPORT_HEADER_DETAILS.logoPath}`;
  const contacts = REPORT_HEADER_DETAILS.contacts.join(" / ");
  const address = REPORT_HEADER_DETAILS.postalAddress.join(", ");

  let bodyContent = "";

  if (config.groupBy && config.groupBy.length > 0) {
    for (const group of config.groupBy) {
      bodyContent += `<div class="section">`;
      bodyContent += `<h2>${escapeHtml(group.label)}</h2>`;
      bodyContent += buildTableHtml(
        group.subHeaders || config.headers,
        group.subRows || [],
      );
      if (group.subTotals) {
        bodyContent += `<div class="subtotal">Subtotal: ${group.subTotals.map((v, i) => `${config.headers[i] || ""}: ${typeof v === "number" ? currency(v) : escapeHtml(v)}`).join(" &nbsp;|&nbsp; ")}</div>`;
      }
      bodyContent += `</div>`;
    }
  } else {
    bodyContent = buildTableHtml(config.headers, config.rows);
  }

  let totalsHtml = "";
  if (config.totals) {
    totalsHtml = `<div class="grand">TOTAL: ${config.totals.map((v, i) => `${config.headers[i] || ""}: ${typeof v === "number" ? currency(v) : escapeHtml(v)}`).join(" &nbsp;|&nbsp; ")}</div>`;
  }

  let summaryHtml = "";
  if (config.summary) {
    const entries = Object.entries(config.summary)
      .map(([k, v]) => `<div class="summary-item"><span class="summary-label">${escapeHtml(k)}</span><span class="summary-value">${typeof v === "number" ? currency(v) : escapeHtml(v)}</span></div>`)
      .join("");
    summaryHtml = `<div class="summary-block">${entries}</div>`;
  }

  let filtersHtml = "";
  if (config.filters) {
    const entries = Object.entries(config.filters)
      .map(([k, v]) => `<span><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`)
      .join(" &nbsp;&bull;&nbsp; ");
    filtersHtml = `<div class="filters">${entries}</div>`;
  }

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(config.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; line-height: 1.4; }
    .letterhead { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1e1b4b; padding-bottom: 12px; margin-bottom: 12px; }
    .letterhead img { height: 64px; width: 64px; object-fit: contain; border-radius: 50%; }
    .letterhead-text { flex: 1; }
    .letterhead-name { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #1e1b4b; margin: 0; }
    .letterhead-sub { font-size: 11px; color: #475569; margin: 2px 0 0; }
    .report-title { text-align: center; font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 12px 0 4px; color: #0f172a; }
    .report-subtitle { text-align: center; font-size: 13px; color: #475569; margin-bottom: 8px; }
    .meta { color: #475569; font-size: 11px; margin-bottom: 14px; line-height: 1.6; }
    .filters { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 14px; color: #334155; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section h2 { font-size: 15px; margin: 0 0 8px; color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
    th { background: #e2e8f0; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr:nth-child(even) { background: #f8fafc; }
    .subtotal { margin-top: 6px; font-weight: 700; font-size: 11px; color: #334155; }
    .grand { margin-top: 12px; padding-top: 8px; border-top: 2px solid #1e1b4b; font-weight: 800; font-size: 12px; color: #1e1b4b; }
    .summary-block { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 16px; }
    .summary-item { background: #f1f5f9; border-radius: 6px; padding: 8px 12px; }
    .summary-label { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.06em; }
    .summary-value { display: block; font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print {
      body { margin: 12px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" />
    <div class="letterhead-text">
      <p class="letterhead-name">${escapeHtml(REPORT_HEADER_DETAILS.institutionName)}</p>
      <p class="letterhead-sub">${escapeHtml(REPORT_HEADER_DETAILS.registrationNumber)}</p>
      <p class="letterhead-sub">${escapeHtml(contacts)} &bull; ${escapeHtml(address)}</p>
      <p class="letterhead-sub">${escapeHtml(REPORT_HEADER_DETAILS.email)}</p>
    </div>
  </div>
  <div class="report-title">${escapeHtml(config.title)}</div>
  ${config.subtitle ? `<div class="report-subtitle">${escapeHtml(config.subtitle)}</div>` : ""}
  <div class="meta">
    ${config.period ? `<div><strong>Period:</strong> ${escapeHtml(config.period)}</div>` : ""}
    <div><strong>Generated:</strong> ${now}</div>
    <div>Official System Report &bull; ${escapeHtml(REPORT_HEADER_DETAILS.institutionName)}</div>
  </div>
  ${filtersHtml}
  ${summaryHtml}
  ${bodyContent}
  ${totalsHtml}
  <div class="footer">
    Printed on ${now} &bull; ${escapeHtml(REPORT_HEADER_DETAILS.institutionName)} &bull; ${escapeHtml(REPORT_HEADER_DETAILS.registrationNumber)}
  </div>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
