import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import { getBoardRoleLabel, getEffectiveMemberState } from "../../utils/memberBenefits";
import { formatMoney } from "../../utils/numberFormat";
import { openPrintWindow } from "../../utils/print";

const printBase = (title, orientation = "landscape") => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />
<title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
@page{size:A4 ${orientation};margin:10mm}
*{font-family:'Cairo',sans-serif;box-sizing:border-box}
body{margin:0;padding:24px;color:#0f172a;font-size:12px}
.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:16px}
.meta strong{color:#0f766e}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
.card{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#fff}
.card-label{font-size:10px;color:#64748b;font-weight:800;margin-bottom:6px}
.card-value{font-size:20px;font-weight:900;color:#0f172a}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:right;vertical-align:top}
th{background:#0f172a;color:#fff;font-size:11px}
tr:nth-child(even) td{background:#f8fafc}
.section-title{margin:18px 0 10px;font-size:15px;font-weight:900;color:#0f766e}
.empty{padding:24px;text-align:center;color:#94a3b8;font-weight:800;border:1px dashed #cbd5e1;border-radius:12px}
.signature-cell{height:44px;min-width:120px}
.total-row td{font-weight:900;background:#ecfeff !important}
@media print{
body{padding:0}
.meta,.cards,.card,.section-title,.brand-header{break-inside:avoid;page-break-inside:avoid}
table{page-break-inside:auto;break-inside:auto}
thead{display:table-header-group}
tfoot{display:table-footer-group}
tr,td,th{break-inside:avoid;page-break-inside:avoid}
}
${getPrintBrandStyles()}
</style></head><body>`;

const closePrint = `<script>window.onload=()=>{setTimeout(()=>window.print(),500);}</script></body></html>`;

export const printBoardOverview = ({ members, meetings, allowances, termStart, termEnd }) => {
  const win = openPrintWindow("board-overview");
  if (!win) return;

  const heldMeetings = meetings.filter((meeting) => meeting.status === "held");
  const decisionsCount = heldMeetings.reduce((sum, meeting) => sum + (meeting.decisions?.length || 0), 0);
  const totalAllowances = allowances.reduce((sum, row) => sum + Number(row.total || 0), 0);

  const rows = members.length
    ? members.map((member, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${member.name || "—"}</td>
          <td>${getBoardRoleLabel(member) || "—"}</td>
          <td>${member.specialization || "—"}</td>
          <td>${getEffectiveMemberState(member)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" class="empty">لا توجد بيانات أعضاء</td></tr>`;

  win.document.write(
    printBase("ملخص مجلس الإدارة") +
      getPrintBrandHeader({
        reportTitle: "ملخص مجلس الإدارة",
        reportMeta: `الدورة النقابية: ${termStart} إلى ${termEnd}`,
      }) +
      `<div class="cards">
        <div class="card"><div class="card-label">أعضاء المجلس</div><div class="card-value">${members.length}</div></div>
        <div class="card"><div class="card-label">اجتماعات منعقدة</div><div class="card-value">${heldMeetings.length}</div></div>
        <div class="card"><div class="card-label">قرارات معتمدة</div><div class="card-value">${decisionsCount}</div></div>
        <div class="card"><div class="card-label">بدلات معتمدة</div><div class="card-value">${formatMoney(totalAllowances)}</div></div>
      </div>
      <div class="section-title">التشكيل الرسمي للمجلس</div>
      <table>
        <thead><tr><th>#</th><th>الاسم الكامل</th><th>الصفة</th><th>التخصص</th><th>الحالة</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` +
      closePrint
  );
  win.document.close();
};

export const printBoardMeetingsReport = ({ meetings, members }) => {
  const win = openPrintWindow("board-meetings");
  if (!win) return;

  const heldMeetings = meetings.filter((meeting) => meeting.status === "held");
  const memberMap = new Map(members.map((member) => [member.id, member.name || "—"]));
  const rows = heldMeetings.length
    ? heldMeetings.map((meeting, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${meeting.title || "—"}</td>
          <td>${meeting.date || "—"}</td>
          <td>${meeting.attendees?.length || 0}</td>
          <td>${meeting.decisions?.length || 0}</td>
          <td>${(meeting.attendees || []).map((id) => memberMap.get(id) || "—").join("، ") || "—"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="6" class="empty">لا توجد اجتماعات منعقدة</td></tr>`;

  win.document.write(
    printBase("سجل الاجتماعات والقرارات") +
      getPrintBrandHeader({ reportTitle: "سجل الاجتماعات والقرارات" }) +
      `<table>
        <thead><tr><th>#</th><th>عنوان الاجتماع</th><th>التاريخ</th><th>الحاضرون</th><th>القرارات</th><th>الأعضاء الحاضرون</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` +
      closePrint
  );
  win.document.close();
};

export const printBoardAllowancesReport = ({ allowances, termStart, termEnd }) => {
  const win = openPrintWindow("board-allowances");
  if (!win) return;

  const rows = allowances.length
    ? allowances.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.member?.name || "—"}</td>
          <td>${getBoardRoleLabel(row.member) || "—"}</td>
          <td>${formatMoney(row.allowances?.sessions || 0)}</td>
          <td>${formatMoney(row.allowances?.travel || 0)}</td>
          <td>${formatMoney(row.allowances?.hospitality || 0)}</td>
          <td>${formatMoney(row.total || 0)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="7" class="empty">لا توجد بدلات معتمدة</td></tr>`;

  win.document.write(
    printBase("تقرير البدلات المعتمدة") +
      getPrintBrandHeader({
        reportTitle: "تقرير البدلات المعتمدة",
        reportMeta: `من التسويات المعتمدة خلال الدورة ${termStart} إلى ${termEnd}`,
      }) +
      `<table>
        <thead><tr><th>#</th><th>الاسم الكامل</th><th>الصفة</th><th>بدل الجلسات</th><th>بدل الانتقال</th><th>بدل الضيافة</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` +
      closePrint
  );
  win.document.close();
};

export const printBoardMeetingAttendanceReport = ({ meeting, members, sessionAllowance = 75 }) => {
  const win = openPrintWindow(`board-meeting-attendance-${meeting?.id || "sheet"}`);
  if (!win) return;

  const attendees = (Array.isArray(members) ? members : []).filter((member) =>
    (meeting?.attendees || []).includes(member.id)
  );
  const total = attendees.length * Number(sessionAllowance || 0);
  const rows = attendees.length
    ? attendees.map((member, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${member.name || "—"}</td>
          <td>${getBoardRoleLabel(member) || "—"}</td>
          <td>${getEffectiveMemberState(member)}</td>
          <td>${formatMoney(sessionAllowance)}</td>
          <td class="signature-cell"></td>
        </tr>
      `).join("")
    : `<tr><td colspan="6" class="empty">لا يوجد أعضاء حضور مسجلون لهذا الاجتماع</td></tr>`;

  win.document.write(
    printBase("كشف حضور مجلس الإدارة", "portrait") +
      getPrintBrandHeader({
        reportTitle: "كشف حضور اجتماع مجلس الإدارة",
        reportMeta: `${meeting?.title || "اجتماع مجلس الإدارة"} • ${meeting?.date || "—"}${meeting?.venue ? ` • ${meeting.venue}` : ""}`,
      }) +
      `<div class="cards">
        <div class="card"><div class="card-label">عنوان الاجتماع</div><div class="card-value">${meeting?.title || "—"}</div></div>
        <div class="card"><div class="card-label">تاريخ الاجتماع</div><div class="card-value">${meeting?.date || "—"}</div></div>
        <div class="card"><div class="card-label">عدد الحضور</div><div class="card-value">${attendees.length}</div></div>
        <div class="card"><div class="card-label">إجمالي الكشف</div><div class="card-value">${formatMoney(total)}</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>الحالة</th><th>بدل الجلسة</th><th>التوقيع</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="4">إجمالي كشف الحضور</td>
            <td colspan="2">${formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:32px;margin-top:42px">
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155">توقيع رئيس المجلس</div>
          <div style="height:56px;border-bottom:2px dashed #cbd5e1;margin-top:16px"></div>
        </div>
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155">توقيع أمين الصندوق</div>
          <div style="height:56px;border-bottom:2px dashed #cbd5e1;margin-top:16px"></div>
        </div>
      </div>` +
      closePrint
  );
  win.document.close();
};
