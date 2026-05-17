import { getPrintBrandHeader, getPrintBrandStyles } from "../../../utils/branding";
import { openPrintWindow } from "../../../utils/print";
import { getEffectiveMemberState } from "../../../utils/memberBenefits";

const GROUP_LABELS = {
  workplace: "جهة العمل",
  memberState: "الحالة",
  membershipStatus: "نوع العضوية",
  gender: "الجنس",
};

const calcAge = (birthDateStr) => {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split("/");
  let d, m, y;
  if (parts.length === 3) {
    if (parts[2].length === 4) { y = +parts[2]; m = +parts[1] - 1; d = +parts[0]; }
    else { y = +parts[0]; m = +parts[1] - 1; d = +parts[2]; }
  }
  if (!y) return null;
  const birth = new Date(y, m, d);
  if (isNaN(birth)) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function printMemberReport({ employees, groupBy, title, subtitle }) {
  const win = openPrintWindow("member-report");
  if (!win) return;

  const sorted = [...employees].sort((a, b) => {
    const na = parseInt(String(a.jobId || "0"), 10);
    const nb = parseInt(String(b.jobId || "0"), 10);
    return na - nb;
  });

  const groupKey = groupBy || "none";
  const grouped = {};
  sorted.forEach((emp) => {
    const key =
      groupKey === "none"
        ? "_all"
        : escapeHtml(emp[groupKey]?.trim() || "غير محدد");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(emp);
  });

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) =>
    a === "_all" ? -1 : b === "_all" ? 1 : a.localeCompare(b)
  );

  const totalCount = sorted.length;
  const activeCount = sorted.filter((e) => getEffectiveMemberState(e) === "نشط").length;
  const maleCount = sorted.filter((e) => e.gender === "ذكر").length;
  const femaleCount = sorted.filter((e) => e.gender === "أنثى").length;
  const groupLabel = GROUP_LABELS[groupKey] || "";

  const groupSections = sortedGroups
    .map(
      ([groupName, members]) => `
    <div class="section">
      ${groupKey !== "none" ? `<div class="section-title">${groupName} (${members.length})</div>` : ""}
      <table>
        <thead>
          <tr>
            <th class="nowrap">#</th>
            <th class="nowrap">الاسم</th>
            <th class="nowrap">الرقم الوظيفي</th>
            <th class="nowrap">جهة العمل</th>
            <th class="nowrap">رقم الموبايل</th>
            <th class="nowrap">الرقم القومي</th>
            <th class="nowrap">السن</th>
            <th class="nowrap">الحالة</th>
            <th class="nowrap">نوع العضوية</th>
          </tr>
        </thead>
        <tbody>
          ${members
            .map(
              (emp, i) => {
                const age = calcAge(emp.birthDate || emp.dateOfBirth);
                return `
          <tr>
            <td class="nowrap">${i + 1}</td>
            <td class="nowrap">${escapeHtml(emp.name || "—")}</td>
            <td class="nowrap">${escapeHtml(emp.jobId || "—")}</td>
            <td class="nowrap">${escapeHtml(emp.workplace || "—")}</td>
            <td class="nowrap">${escapeHtml(emp.phone || emp.mobile || "—")}</td>
            <td class="nowrap">${escapeHtml(emp.nationalId || emp.national_id || "—")}</td>
            <td class="nowrap">${age !== null ? age + " سنة" : "—"}</td>
            <td class="nowrap">${escapeHtml(getEffectiveMemberState(emp) || "—")}</td>
            <td class="nowrap">${escapeHtml(emp.membershipStatus || "—")}</td>
          </tr>`;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>`
    )
    .join("");

  win.document.write(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />
    <title>${escapeHtml(title || "كشف أعضاء")}</title>
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
    @page{size:A4 portrait;margin:8mm 8mm 12mm 8mm}
    *{font-family:'Cairo',sans-serif;box-sizing:border-box}
    body{margin:0;padding:0 0 10px 0;color:#0f172a;font-size:10px}
    .section{margin-bottom:12px}
    .section-title{margin:10px 0 4px;font-size:11px;font-weight:900;color:#0f766e;padding:3px 0;border-bottom:1px solid #e2e8f0}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:8px 0}
    .summary-item{border:1px solid #e2e8f0;border-radius:8px;padding:6px;text-align:center}
    .summary-value{font-size:16px;font-weight:900;color:#0f172a}
    .summary-label{font-size:7px;color:#64748b;font-weight:800}
    table{width:100%;border-collapse:collapse;margin-top:3px;font-size:8px}
    th,td{border:1px solid #cbd5e1;padding:2px 3px;text-align:right}
    th{background:#0f172a;color:#fff;font-size:7px}
    tr:nth-child(even) td{background:#f8fafc}
    .nowrap{white-space:nowrap}
    @media print{
      body{padding:0 0 16px 0}
      .brand-header{margin-bottom:6px;padding-bottom:6px}
      .summary{margin:6px 0}
      table{page-break-inside:auto;break-inside:auto}
      thead{display:table-header-group}
      tr,td,th{break-inside:auto;page-break-inside:auto}
    }
    ${getPrintBrandStyles()}
    </style></head><body>
    ${getPrintBrandHeader({
      reportTitle: `${escapeHtml(title || "كشف أعضاء")}${groupLabel ? ` • حسب ${groupLabel}` : ""}`,
      reportMeta: subtitle ? escapeHtml(subtitle) : `إجمالي الأعضاء: ${totalCount} | نشط: ${activeCount} | ذكور: ${maleCount} | إناث: ${femaleCount}`,
    })}
    <div class="summary">
      <div class="summary-item"><div class="summary-value">${totalCount}</div><div class="summary-label">إجمالي الأعضاء</div></div>
      <div class="summary-item"><div class="summary-value">${activeCount}</div><div class="summary-label">نشط</div></div>
      <div class="summary-item"><div class="summary-value">${maleCount}</div><div class="summary-label">ذكور</div></div>
      <div class="summary-item"><div class="summary-value">${femaleCount}</div><div class="summary-label">إناث</div></div>
    </div>
    ${groupSections}
    <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
    </body></html>`
  );
  win.document.close();
}
