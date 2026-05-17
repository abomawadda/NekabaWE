import {
  ORG_REPORT_TITLE,
  ORG_REPORT_SUBTITLE,
  ORG_LEFT_LOGO_URL,
  ORG_RIGHT_LOGO_URL,
  ORG_SYSTEM_TITLE,
  ORG_IMPLEMENTATION_CREDIT,
  getPrintBrandStyles,
} from "../../../utils/branding";
import { openPrintWindow } from "../../../utils/print";

const escapeHtml = (value = "") =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function getTodayArabic() {
  const d = new Date();
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} م`;
}

export function printMembershipCertificate(employee) {
  const win = openPrintWindow("membership-certificate");
  if (!win) return;

  const emp = employee || {};
  const certNumber = `ش.ق/${String(emp.jobId || "00000").padStart(5, "0")}/${new Date().getFullYear()}`;

  win.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>شهادة قيد</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
    @page { size: A4 portrait; margin: 15mm 18mm; }
    * { font-family: 'Cairo', sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
    body {
      margin: 0; padding: 0; color: #0f172a; font-size: 12px;
      display: flex; flex-direction: column; min-height: 100vh;
    }
    .cert-container {
      flex: 1; border: 3px solid #0f766e; border-radius: 12px;
      padding: 40px 35px; display: flex; flex-direction: column;
      position: relative; overflow: hidden;
    }
    .cert-watermark {
      position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; pointer-events: none; z-index: 0;
    }
    .cert-watermark span {
      font-size: 80px; font-weight: 900; color: rgba(15,118,110,0.04);
      transform: rotate(-30deg); letter-spacing: 0.06em;
    }
    .cert-header {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 20px;
      position: relative; z-index: 1;
    }
    .cert-header img { width: 52px; height: 52px; object-fit: contain; }
    .cert-header-center { flex: 1; text-align: center; }
    .cert-header-title { font-size: 16px; font-weight: 900; color: #0f172a; line-height: 1.3; }
    .cert-header-sub { font-size: 11px; font-weight: 800; color: #0f766e; margin-top: 2px; }
    .cert-badge {
      display: inline-block; background: #0f766e; color: #fff;
      padding: 4px 18px; border-radius: 20px; font-size: 9px; font-weight: 900;
      letter-spacing: 1px; margin-top: 6px;
    }
    .cert-body { flex: 1; position: relative; z-index: 1; }
    .cert-title {
      text-align: center; font-size: 20px; font-weight: 900; color: #0f766e;
      margin: 14px 0 22px; letter-spacing: 2px;
    }
    .cert-statement {
      font-size: 13px; line-height: 2.2; text-align: center;
      margin: 10px 0 20px; color: #1e293b; font-weight: 700;
    }
    .cert-statement span.highlight {
      color: #0f766e; font-weight: 900; font-size: 14px;
    }
    .cert-info-table {
      width: 70%; margin: 18px auto; border-collapse: collapse;
    }
    .cert-info-table td {
      padding: 6px 10px; border-bottom: 1px dashed #e2e8f0;
      font-size: 12px; font-weight: 700;
    }
    .cert-info-table td:first-child {
      color: #64748b; font-weight: 800; width: 40%; text-align: left;
    }
    .cert-info-table td:last-child {
      color: #0f172a; font-weight: 900; width: 60%; text-align: right;
    }
    .cert-footer {
      border-top: 2px solid #0f766e; padding-top: 16px; margin-top: 20px;
      display: flex; justify-content: space-between; align-items: flex-end;
      position: relative; z-index: 1;
    }
    .cert-footer-right { text-align: center; }
    .cert-footer-label { font-size: 9px; font-weight: 800; color: #64748b; margin-bottom: 4px; }
    .cert-footer-line { width: 160px; height: 1px; background: #94a3b8; margin: 4px 0; }
    .cert-footer-left { text-align: left; }
    .cert-footer-text { font-size: 8px; color: #94a3b8; font-weight: 700; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cert-container { border-color: #0f766e; }
      .cert-watermark span { color: rgba(15,118,110,0.04); }
    }
    ${getPrintBrandStyles()}
  </style>
</head>
<body>
  <div class="cert-container">
    <div class="cert-watermark"><span>شهادة قيد</span></div>

    <div class="cert-header">
      <img src="${escapeHtml(ORG_RIGHT_LOGO_URL)}" alt="logo" />
      <div class="cert-header-center">
        <div class="cert-header-title">${escapeHtml(ORG_REPORT_TITLE)}</div>
        <div class="cert-header-sub">${escapeHtml(ORG_REPORT_SUBTITLE)}</div>
        <div class="cert-badge">شهادة قيد رقم ${escapeHtml(certNumber)}</div>
      </div>
      <img src="${escapeHtml(ORG_LEFT_LOGO_URL)}" alt="logo" />
    </div>

    <div class="cert-body">
      <div class="cert-title">شَهَادَةُ قَيْدٍ</div>

      <div class="cert-statement">
        يشهد أمين الصندوق للنقابة العامة للعاملين بالاتصالات بالدقهلية
        <br/>
        بأن السيد/ <span class="highlight">${escapeHtml(emp.name || "—")}</span>
        <br/>
        مقيد بسجلات النقابة بعضوية <span class="highlight">${escapeHtml(emp.membershipStatus || "—")}</span>
        <br/>
        وله كامل حقوق العضوية وفقًا للائحة النظام الأساسي.
      </div>

      <table class="cert-info-table">
        <tr><td>الرقم الوظيفي</td><td>${escapeHtml(emp.jobId || "—")}</td></tr>
        <tr><td>الرقم القومي</td><td>${escapeHtml(emp.nationalId || emp.national_id || "—")}</td></tr>
        <tr><td>المسمى الوظيفي</td><td>${escapeHtml(emp.jobTitle || "—")}</td></tr>
        <tr><td>جهة العمل</td><td>${escapeHtml(emp.workplace || "—")}</td></tr>
        <tr><td>الحالة</td><td>${escapeHtml(emp.memberState || emp.status || "—")}</td></tr>
      </table>

      <div class="cert-statement" style="font-size:11px; color:#64748b; margin-top:8px;">
        أعطيت لهذه الشهادة بناءً على طلبه لتقديمها إلى الجهات المختصة.
      </div>
    </div>

    <div class="cert-footer">
      <div class="cert-footer-right">
        <div class="cert-footer-label">أمين الصندوق</div>
        <div class="cert-footer-line"></div>
        <div class="cert-footer-label" style="font-size:8px; margin-top:2px;">التوقيع</div>
      </div>
      <div class="cert-footer-left">
        <div class="cert-footer-text">تاريخ الإصدار: ${getTodayArabic()}</div>
        <div class="cert-footer-text" style="margin-top:2px;">رقم الشهادة: ${escapeHtml(certNumber)}</div>
        <div class="cert-footer-text" style="margin-top:2px;">${escapeHtml(ORG_SYSTEM_TITLE)}</div>
      </div>
    </div>
  </div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script>
</body>
</html>`);
  win.document.close();
}
