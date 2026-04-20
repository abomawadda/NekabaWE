import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import { openPrintWindow } from "../../utils/print";
import { tafqeet } from "../../utils/tafqeet";
import { escapeHtml, formatDisplayValue } from "./reportUtils";

export const renderPrintReport = ({
  config,
  rows,
  selectedFields,
  summary,
  period,
}) => {
  const win = openPrintWindow(`report-${config.id}`, "width=1200,height=900");
  if (!win) return;

  const fields = config.fields.filter((field) => selectedFields.includes(field.key));
  const orientation = "portrait";
  const layoutClass = "portrait-report";
  const reportMeta = [
    period?.from && period?.to ? `الفترة: ${period.from} إلى ${period.to}` : "",
    `عدد السجلات: ${rows.length}`,
  ]
    .filter(Boolean)
    .join(" • ");
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
  const toNumeric = (value) => {
    const normalized = String(value ?? "").replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const totalsInWords = summary.currencyFields
    .filter((field) => selectedFields.includes(field.key))
    .map((field) => {
      const totalAmount = toNumeric(summary.totals[field.key] || 0);
      const words = tafqeet(totalAmount);
      return words
        ? `<div class="amount-words-row"><span class="amount-words-label">تفقيط ${escapeHtml(field.label)}:</span><span class="amount-words-value">${escapeHtml(words)}</span></div>`
        : "";
    })
    .filter(Boolean)
    .join("");

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
          body{padding:8px 0 26px;color:#0f172a;background:#fff;font-size:11px}
          .sheet{display:block;position:relative;z-index:1;padding-bottom:20px}
          .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:8px}
          .summary-card{border:1px solid #dbeafe;border-radius:12px;padding:8px 10px;background:linear-gradient(180deg,#f8fafc,#ffffff)}
          .summary-label{font-size:8.5px;font-weight:900;color:#64748b;margin-bottom:4px;line-height:1.4}
          .summary-value{font-size:14px;font-weight:900;color:#0f766e;line-height:1.25}
          .table-shell{border:1px solid #cbd5e1;border-radius:16px;overflow:hidden}
          .summary-sections{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
          .summary-section{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}
          .summary-section-title{font-size:9px;font-weight:900;color:#0f172a;margin-bottom:6px}
          .summary-section-items{display:grid;gap:5px}
          .summary-section-item{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:9px;color:#475569}
          .summary-section-item strong{font-size:9px;color:#0f172a}
          table{width:100%;border-collapse:collapse}
          th{background:#0f172a;color:#fff;padding:9px 7px;border:1px solid #334155;font-size:10px;text-align:right}
          td{border:1px solid #cbd5e1;padding:7px;font-size:10px;vertical-align:top;word-break:break-word}
          tbody tr:nth-child(even){background:#f8fafc}
          .cell-index{text-align:center;font-weight:900;width:42px}
          .cell-amount{text-align:left;font-weight:900;color:#047857;white-space:nowrap}
          .totals-row td{background:#eef2ff;font-weight:900}
          .amount-words{margin-top:10px;border:1px solid #bfdbfe;border-radius:12px;padding:10px;background:#f8fbff;display:grid;gap:6px}
          .amount-words-row{display:flex;gap:8px;flex-wrap:wrap;font-size:10px;line-height:1.6}
          .amount-words-label{font-weight:900;color:#1e3a8a}
          .amount-words-value{font-weight:800;color:#0f172a}
          .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}
          .sig{padding-top:28px;border-top:1px dashed #94a3b8;text-align:center;font-size:9px;font-weight:800;color:#475569}
          .portrait-report .summary-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
          .portrait-report th,.portrait-report td{font-size:9px;padding:5px 4px}
          .portrait-report .summary-value{font-size:13px}
          .portrait-report .summary-sections{grid-template-columns:repeat(2,minmax(0,1fr))}
          @media print{
            body{padding:0 0 16px}
            .sheet,.summary-grid,.summary-card,.summary-sections,.summary-section,.signatures,.sig,.table-shell{break-inside:auto;page-break-inside:auto}
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
          ${getPrintBrandHeader({ reportTitle: config.title, reportMeta })}
          <div class="summary-grid">${summaryCards}</div>
          <div class="table-shell">
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
          </div>
          ${totalsInWords ? `<div class="amount-words">${totalsInWords}</div>` : ""}
          ${summarySectionsHtml ? `<div class="summary-sections">${summarySectionsHtml}</div>` : ""}
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
