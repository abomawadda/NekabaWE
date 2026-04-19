import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import { openPrintWindow } from "../../utils/print";
import { escapeHtml, formatDisplayValue } from "./reportUtils";

export const renderPrintReport = ({
  config,
  rows,
  selectedFields,
  summary,
}) => {
  const win = openPrintWindow(`report-${config.id}`, "width=1200,height=900");
  if (!win) return;

  const fields = config.fields.filter((field) => selectedFields.includes(field.key));
  const orientation = "portrait";
  const layoutClass = "portrait-report";
  const summaryCardsData =
    Array.isArray(summary?.customSummary?.cards) && summary.customSummary.cards.length > 0
      ? summary.customSummary.cards
      : [
          { label: "إجمالي السجلات", value: String(rows.length) },
          ...summary.currencyFields.slice(0, 3).map((field) => ({
            label: field.label,
            value: formatDisplayValue(field, summary.totals[field.key] || 0),
          })),
        ];

  const summaryCards = summaryCardsData
    .map(
      (card) => `
        <div class="summary-card">
          <div class="summary-label">${escapeHtml(card.label)}</div>
          <div class="summary-value">${escapeHtml(card.value)}</div>
        </div>
      `
    )
    .join("");

  const summarySectionsHtml = Array.isArray(summary?.customSummary?.sections)
    ? summary.customSummary.sections
        .map(
          (section) => `
            <div class="summary-section">
              <div class="summary-section-title">${escapeHtml(section.title)}</div>
              <div class="summary-section-items">
                ${(section.items || [])
                  .map(
                    (item) => `
                      <div class="summary-section-item">
                        <span>${escapeHtml(item.label)}</span>
                        <strong>${escapeHtml(item.value)}</strong>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
          `
        )
        .join("")
    : "";

  const headersHtml = fields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join("");
  const rowsHtml = rows
    .map((row, index) => {
      const cells = fields
        .map((field) => {
          const value = formatDisplayValue(field, row[field.key]);
          const className = field.currency ? "cell-amount" : "";
          return `<td class="${className}">${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr><td class="cell-index">${index + 1}</td>${cells}</tr>`;
    })
    .join("");

  const totalsRow = config.showTotals !== false && summary.currencyFields.some((field) => selectedFields.includes(field.key))
    ? `
      <tr class="totals-row">
        <td class="cell-index">#</td>
        ${fields
          .map((field, index) => {
            if (index === 0) return `<td>الإجمالي</td>`;
            if (field.currency) {
              return `<td class="cell-amount">${escapeHtml(formatDisplayValue(field, summary.totals[field.key] || 0))}</td>`;
            }
            return `<td>—</td>`;
          })
          .join("")}
      </tr>
    `
    : "";

  win.document.write(`<!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(config.title)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          @page { size: A4 ${orientation}; margin: 10mm; }
          *{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif}
          html,body{width:100%;height:auto}
          body{padding:10px 0 30px;color:#0f172a;background:#fff;font-size:11px}
          .sheet{display:block;position:relative;z-index:1;padding-bottom:24px}
          .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
          .summary-card{border:1px solid #dbeafe;border-radius:14px;padding:12px;background:linear-gradient(180deg,#f8fafc,#ffffff)}
          .summary-label{font-size:10px;font-weight:800;color:#64748b;margin-bottom:6px}
          .summary-value{font-size:18px;font-weight:900;color:#0f766e}
          .summary-sections{display:grid;grid-template-columns:repeat(1,1fr);gap:10px;margin-top:10px;margin-bottom:10px}
          .summary-section{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#f8fafc}
          .summary-section-title{font-size:10px;font-weight:900;color:#0f172a;margin-bottom:8px}
          .summary-section-items{display:grid;gap:6px}
          .summary-section-item{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:10px;color:#475569}
          .summary-section-item strong{font-size:10px;color:#0f172a}
          table{width:100%;border-collapse:collapse}
          th{background:#0f172a;color:#fff;padding:9px 7px;border:1px solid #334155;font-size:10px;text-align:right}
          td{border:1px solid #cbd5e1;padding:7px;font-size:10px;vertical-align:top;word-break:break-word}
          tbody tr:nth-child(even){background:#f8fafc}
          .cell-index{text-align:center;font-weight:900;width:42px}
          .cell-amount{text-align:left;font-weight:900;color:#047857;white-space:nowrap}
          .totals-row td{background:#eef2ff;font-weight:900}
          .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px}
          .sig{padding-top:34px;border-top:1px dashed #94a3b8;text-align:center;font-size:10px;font-weight:800;color:#475569}
          .portrait-report .summary-grid{grid-template-columns:repeat(2,1fr)}
          .portrait-report th,.portrait-report td{font-size:9.2px;padding:6px 5px}
          .portrait-report .summary-value{font-size:16px}
          .portrait-report .summary-sections{grid-template-columns:repeat(1,1fr)}
          @media print{
            body{padding:0 0 18px}
            .sheet,.summary-grid,.summary-card,.summary-sections,.summary-section,.signatures,.sig{break-inside:auto;page-break-inside:auto}
            .summary-grid,.summary-sections,.summary-section,.signatures,.brand-header,.print-footer{break-inside:avoid;page-break-inside:avoid}
            .summary-card{break-inside:avoid;page-break-inside:avoid}
            table{page-break-inside:auto;break-inside:auto}
            thead{display:table-header-group}
            tfoot{display:table-footer-group}
            tbody{break-inside:auto;page-break-inside:auto}
            tr,td,th{break-inside:avoid;page-break-inside:avoid}
            .totals-row{break-inside:avoid;page-break-inside:avoid}
          }
          ${getPrintBrandStyles()}
        </style>
      </head>
      <body>
        <div class="sheet ${layoutClass}">
          ${getPrintBrandHeader({ reportTitle: config.title })}
          <div class="summary-grid">${summaryCards}</div>
          ${summarySectionsHtml ? `<div class="summary-sections">${summarySectionsHtml}</div>` : ""}
          <table>
            <thead>
              <tr>
                <th class="cell-index">#</th>
                ${headersHtml}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${fields.length + 1}" style="text-align:center;padding:24px;color:#64748b">${escapeHtml(config.emptyMessage)}</td></tr>`}
              ${totalsRow}
            </tbody>
          </table>
          <div class="signatures">
            <div class="sig">إعداد التقرير</div>
            <div class="sig">المراجعة</div>
            <div class="sig">الاعتماد</div>
          </div>
        </div>
        <script>window.onload=()=>setTimeout(()=>window.print(),500);</script>
      </body>
    </html>`);

  win.document.close();
};
