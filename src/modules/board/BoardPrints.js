import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import { getBoardRoleLabel, getEffectiveMemberState } from "../../utils/memberBenefits";
import { formatMoney } from "../../utils/numberFormat";
import { openPrintWindow } from "../../utils/print";
import { getMeetingAttendanceRecords, getMeetingAttendeeIds } from "./boardLifecycle";
import { tafqeet } from "../../utils/tafqeet";

const DECISION_STATUS_AR = { new: "جديد", in_progress: "قيد التنفيذ", completed: "منفذ", stalled: "متعثر" };

const printBase = (title, orientation = "portrait") => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />
<title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
@page{size:A4 ${orientation};margin:10mm}
*{font-family:'Cairo',sans-serif;box-sizing:border-box}
body{margin:0;padding:20px;color:#0f172a;font-size:11px}
.meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:12px}
.meta strong{color:#0f766e}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
.card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff}
.card-label{font-size:9px;color:#64748b;font-weight:800;margin-bottom:4px}
.card-value{font-size:16px;font-weight:900;color:#0f172a}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#0f172a;color:#fff;font-size:10px}
tr:nth-child(even) td{background:#f8fafc}
.section-title{margin:14px 0 8px;font-size:13px;font-weight:900;color:#0f766e}
.empty{padding:20px;text-align:center;color:#94a3b8;font-weight:800;border:1px dashed #cbd5e1;border-radius:10px}
.signature-cell{height:40px;min-width:100px}
.total-row td{font-weight:900;background:#ecfeff !important}
.nowrap{white-space:nowrap}
.bayan-cell{word-break:break-word;white-space:normal;font-size:10px}
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

const dash = "—";

const escapeHtml = (value = "") =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const parseDate = (ds) => {
  if (!ds) return null;
  try {
    const d = new Date(ds.replace(/(\d+)\/(\d+)\/(\d+)/, "$3/$2/$1"));
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
};

const isMemberEligibleOnDate = (member, meetingDateStr) => {
  const state = getEffectiveMemberState(member);
  if (state === "نشط" || state === "موقوف") return true;
  if (state === "وفاة" || state === "معاش" || state === "استقالة") {
    const dateFields = [
      member.retirementDate, member.retiredAt, member.retireDate,
      member.pensionDate, member.membershipExpiry, member.membershipEndDate,
      member.boardMembership?.endDate, member.endDate,
    ];
    const endDate = dateFields.find((d) => d);
    if (endDate) {
      const meetingDate = parseDate(meetingDateStr);
      const memberEnd = parseDate(endDate);
      if (meetingDate && memberEnd && meetingDate > memberEnd) return false;
    }
  }
  return true;
};

const sortMeetingsAsc = (meetings = []) =>
  [...meetings].sort((a, b) => {
    const da = parseDate(a.date)?.getTime() || 0;
    const db = parseDate(b.date)?.getTime() || 0;
    return da - db;
  });

const buildLegacyAttendanceRows = (meeting = {}, members = [], sessionAllowance = 75) =>
  (Array.isArray(members) ? members : [])
    .filter((member) => (meeting?.attendees || []).includes(member.id))
    .map((member) => ({
      member,
      role: getBoardRoleLabel(member) || dash,
      memberState: getEffectiveMemberState(member),
      allowance: Number(sessionAllowance || 0),
    }));

const getMeetingAttendeeRows = (meeting = {}, members = [], sessionAllowance = 75) => {
  const attendanceRecords = getMeetingAttendanceRecords(meeting);
  if (attendanceRecords.length === 0) {
    return buildLegacyAttendanceRows(meeting, members, sessionAllowance);
  }

  const memberMap = new Map((members || []).map((member) => [member.id, member]));

  return attendanceRecords.map((record) => {
    const liveMember = memberMap.get(record.memberId) || {};
    const mergedMember = {
      ...liveMember,
      id: record.memberId,
      name: record.memberName || liveMember.name || dash,
      boardRoleTitle: record.role || liveMember.boardRoleTitle || liveMember.membershipStatus || dash,
      membershipStatus: record.role || liveMember.membershipStatus || dash,
      memberState: record.memberStateAtMeeting || liveMember.memberState || dash,
    };

    return {
      member: mergedMember,
      role: record.role || getBoardRoleLabel(mergedMember) || dash,
      memberState: record.memberStateAtMeeting || mergedMember.memberState || dash,
      allowance: Number(sessionAllowance || 0),
    };
  });
};

export const printBoardOverview = ({ members, meetings, allowances, termStart, termEnd }) => {
  const win = openPrintWindow("board-overview");
  if (!win) return;

  const heldMeetings = meetings.filter((meeting) => meeting.status === "held");
  const decisionsCount = heldMeetings.reduce((sum, meeting) => sum + (meeting.decisions?.length || 0), 0);
  const totalAllowances = allowances.reduce((sum, row) => sum + Number(row.total || 0), 0);

  const rows = members.length
    ? members
        .map(
          (member, index) => `
        <tr>
          <td class="nowrap">${index + 1}</td>
          <td class="nowrap">${escapeHtml(member.name || dash)}</td>
          <td class="nowrap">${escapeHtml(member.nationalId || member.national_id || member.nid || dash)}</td>
          <td class="nowrap">${escapeHtml(member.phone || member.mobile || dash)}</td>
          <td class="nowrap">${escapeHtml(member.jobId || dash)}</td>
          <td class="nowrap">${escapeHtml(getBoardRoleLabel(member) || dash)}</td>
          <td class="nowrap">${escapeHtml(getEffectiveMemberState(member) || dash)}</td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="7" class="empty">لا توجد بيانات أعضاء</td></tr>`;
  const cardsGrid = members.length >= 6 ? "repeat(4,1fr)" : "repeat(2,1fr)";

  win.document.write(
    printBase("ملخص مجلس الإدارة") +
      getPrintBrandHeader({
        reportTitle: "ملخص مجلس الإدارة",
        reportMeta: `الدورة النقابية: ${escapeHtml(termStart)} إلى ${escapeHtml(termEnd)}`,
      }) +
      `<div class="cards" style="grid-template-columns:${cardsGrid}">
        <div class="card"><div class="card-label">أعضاء المجلس</div><div class="card-value">${members.length}</div></div>
        <div class="card"><div class="card-label">اجتماعات منعقدة</div><div class="card-value">${heldMeetings.length}</div></div>
        <div class="card"><div class="card-label">قرارات معتمدة</div><div class="card-value">${decisionsCount}</div></div>
        <div class="card"><div class="card-label">بدلات معتمدة</div><div class="card-value">${formatMoney(totalAllowances)}</div></div>
      </div>
      <div class="section-title">التشكيل الرسمي للمجلس</div>
      <table>
        <thead><tr><th>#</th><th>الاسم الكامل</th><th>الرقم القومي</th><th>رقم الموبايل</th><th>الرقم الوظيفي</th><th>صفة العضوية</th><th>الحالة</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${renderTafqeetRow(totalAllowances)}` +
      closePrint
  );
  win.document.close();
};

export const printBoardMeetingsReport = ({ meetings, members }) => {
  const win = openPrintWindow("board-meetings");
  if (!win) return;

  const heldMeetings = sortMeetingsAsc(meetings.filter((meeting) => meeting.status === "held"));
  const memberNameById = new Map((members || []).map((m) => [m.id, m.name || m.jobId || "—"]));

  const getMeetingAttendanceSummary = (meeting) => {
    const attendeeIds = getMeetingAttendeeIds(meeting);
    const activeMembers = (members || []).filter((m) => isMemberEligibleOnDate(m, meeting.date));
    const absentMembers = activeMembers.filter((m) => !attendeeIds.includes(m.id) && m.id);
    const attendeeNames = attendeeIds.map((id) => memberNameById.get(id)).filter(Boolean);

    if (absentMembers.length === 0) {
      return `جميع أعضاء المجلس (${attendeeNames.join("، ")})`;
    }
    const absentNames = absentMembers.map((m) => m.name || memberNameById.get(m.id) || "—").filter(Boolean);
    return `جميع أعضاء المجلس ما عدا: ${absentNames.join("، ")}`;
  };

  const rows = heldMeetings.length
    ? heldMeetings
        .map(
          (meeting, index) => `
        <tr>
          <td class="nowrap">${index + 1}</td>
          <td class="nowrap">${escapeHtml(meeting.title || dash)}</td>
          <td class="nowrap">${escapeHtml(meeting.date || dash)}</td>
          <td class="nowrap">${getMeetingAttendanceRecords(meeting).length || meeting.attendees?.length || 0}</td>
          <td class="nowrap">${meeting.decisions?.length || 0}</td>
          <td class="bayan-cell">${escapeHtml(getMeetingAttendanceSummary(meeting))}</td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="6" class="empty">لا توجد اجتماعات منعقدة</td></tr>`;

  win.document.write(
    printBase("سجل الاجتماعات والقرارات") +
      getPrintBrandHeader({ reportTitle: "سجل الاجتماعات والقرارات" }) +
      `<table>
        <thead><tr><th class="nowrap">#</th><th class="nowrap">عنوان الاجتماع</th><th class="nowrap">التاريخ</th><th class="nowrap">الحاضرون</th><th class="nowrap">القرارات</th><th>بيان الحضور</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` +
      closePrint
  );
  win.document.close();
};

const renderOtherAllowancesDetail = (other = []) => {
  if (!other.length) return "";
  return other
    .map(
      (o) =>
        `<tr><td style="text-align:center">${escapeHtml(o.category)}</td><td style="text-align:center">${formatMoney(o.amount || 0)}</td></tr>`
    )
    .join("");
};

const renderTafqeetRow = (total) => {
  const words = tafqeet(Math.abs(total));
  if (!words) return "";
  const prefix = total < 0 ? "مطروح منه " : "";
  return `<div style="margin-top:10px;padding:8px 12px;background:#fef9c3;border:1px solid #eab308;border-radius:8px;font-size:11px;font-weight:800;color:#854d0e;text-align:center">المبلغ بالتفقيط: ${prefix}${escapeHtml(words)}</div>`;
};

export const printBoardAllowancesReport = ({ allowances, termStart, termEnd }) => {
  const win = openPrintWindow("board-allowances");
  if (!win) return;

  const mainTotal = allowances.reduce((s, r) => s + (r.allowances?.sessions || 0) + (r.allowances?.travel || 0) + (r.allowances?.hospitality || 0), 0);
  const otherTotal = allowances.reduce((s, r) => s + ((r.otherAllowances || []).reduce((a, o) => a + (o.amount || 0), 0)), 0);
  const grandTotal = mainTotal + otherTotal;

  const allOtherCategories = [...new Set(allowances.flatMap((r) => (r.otherAllowances || []).map((o) => o.category)))];

  const rows = allowances.length
    ? allowances
        .map(
          (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="nowrap">${escapeHtml(row.member?.name || dash)}</td>
          <td class="nowrap">${escapeHtml(getBoardRoleLabel(row.member) || dash)}</td>
          <td>${formatMoney(row.allowances?.sessions || 0)}</td>
          <td>${formatMoney(row.allowances?.travel || 0)}</td>
          <td>${formatMoney(row.allowances?.hospitality || 0)}</td>
          ${allOtherCategories.map((cat) => {
            const o = (row.otherAllowances || []).find((x) => x.category === cat);
            return `<td>${formatMoney(o?.amount || 0)}</td>`;
          }).join("")}
          <td>${formatMoney(row.total || 0)}</td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="${7 + allOtherCategories.length}" class="empty">لا توجد بدلات معتمدة</td></tr>`;

  win.document.write(
    printBase("تقرير البدلات المعتمدة") +
      getPrintBrandHeader({
        reportTitle: "تقرير البدلات المعتمدة",
        reportMeta: `من التسويات المعتمدة خلال الدورة ${escapeHtml(termStart)} إلى ${escapeHtml(termEnd)}`,
      }) +
      `<table>
        <thead><tr><th>#</th><th>الاسم الكامل</th><th>الصفة</th><th>بدل الجلسات</th><th>بدل الانتقال</th><th>بدل الضيافة</th>${allOtherCategories.map((c) => `<th class="nowrap">${escapeHtml(c)}</th>`).join("")}<th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="${6 + allOtherCategories.length}">الإجمالي المعتمد</td>
            <td>${formatMoney(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
      ${renderTafqeetRow(grandTotal)}` +
      closePrint
  );
  win.document.close();
};

export const printBoardMeetingAttendanceReport = ({ meeting, members, sessionAllowance = 75 }) => {
  const win = openPrintWindow(`board-meeting-attendance-${meeting?.id || "sheet"}`);
  if (!win) return;

  const attendeeRows = getMeetingAttendeeRows(meeting, members, sessionAllowance);
  const total = attendeeRows.reduce((sum, row) => sum + Number(row.allowance || 0), 0);
  const rows = attendeeRows.length
    ? attendeeRows
        .map(
          (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.member?.name || dash)}</td>
          <td>${escapeHtml(row.role || dash)}</td>
          <td>${escapeHtml(row.memberState || dash)}</td>
          <td>${formatMoney(row.allowance || 0)}</td>
          <td class="signature-cell"></td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="6" class="empty">لا يوجد أعضاء حضور مسجلون لهذا الاجتماع</td></tr>`;

  win.document.write(
    printBase("كشف حضور مجلس الإدارة", "portrait") +
      getPrintBrandHeader({
        reportTitle: "كشف حضور اجتماع مجلس الإدارة",
        reportMeta: `${escapeHtml(meeting?.title || "اجتماع مجلس الإدارة")} • ${escapeHtml(meeting?.date || dash)}${
          meeting?.venue ? ` • ${escapeHtml(meeting.venue)}` : ""
        }`,
      }) +
      `<div class="cards">
        <div class="card"><div class="card-label">عنوان الاجتماع</div><div class="card-value">${escapeHtml(meeting?.title || dash)}</div></div>
        <div class="card"><div class="card-label">تاريخ الاجتماع</div><div class="card-value">${escapeHtml(meeting?.date || dash)}</div></div>
        <div class="card"><div class="card-label">عدد الحضور</div><div class="card-value">${attendeeRows.length}</div></div>
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
      ${renderTafqeetRow(total)}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:32px;margin-top:32px">
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

export const printMeetingMinutes = ({ meeting, decisions, attendanceRecords }) => {
  const win = openPrintWindow(`board-minutes-${meeting?.id || "sheet"}`);
  if (!win) return;

  const attendeeRows = (attendanceRecords || getMeetingAttendanceRecords(meeting)).filter(r => r.attendanceStatus === "present" || meeting.attendees?.includes(r.memberId));
  const totalDecisions = (decisions || meeting.decisions || []).length;
  const decisionRows = (decisions || meeting.decisions || []).length
    ? (decisions || meeting.decisions || []).map(
        (d, i) => `
      <tr>
        <td style="text-align:center;width:40px">${i + 1}</td>
        <td>${escapeHtml(d.text || "—")}</td>
        <td style="text-align:center">${DECISION_STATUS_AR[d.status] || d.status || "جديد"}</td>
        <td style="text-align:center">${d.votes?.for || 0}</td>
        <td style="text-align:center">${d.votes?.against || 0}</td>
        <td style="text-align:center">${d.votes?.abstain || 0}</td>
      </tr>`
      ).join("")
    : `<tr><td colspan="6" class="empty">لا توجد قرارات</td></tr>`;

  win.document.write(
    printBase("محضر اجتماع مجلس الإدارة", "portrait") +
      getPrintBrandHeader({
        reportTitle: "محضر اجتماع مجلس الإدارة",
        reportMeta: `${escapeHtml(meeting?.title || "اجتماع مجلس الإدارة")} • ${escapeHtml(meeting?.date || dash)}${meeting?.venue ? ` • ${escapeHtml(meeting.venue)}` : ""}`,
      }) +
      `<div class="cards">
        <div class="card"><div class="card-label">عنوان الاجتماع</div><div class="card-value" style="font-size:14px">${escapeHtml(meeting?.title || dash)}</div></div>
        <div class="card"><div class="card-label">التاريخ</div><div class="card-value">${escapeHtml(meeting?.date || dash)}</div></div>
        <div class="card"><div class="card-label">عدد الحضور</div><div class="card-value">${attendeeRows.length}</div></div>
        <div class="card"><div class="card-label">القرارات</div><div class="card-value">${totalDecisions}</div></div>
      </div>
      <div class="section-title">قائمة الحضور</div>
      <table>
        <thead><tr><th>#</th><th>الاسم</th><th>الصفة</th><th>الحالة</th><th>التوقيع</th></tr></thead>
        <tbody>${attendeeRows.map((r, i) => `
          <tr>
            <td style="text-align:center">${i + 1}</td>
            <td>${escapeHtml(r.memberName || r.member?.name || dash)}</td>
            <td>${escapeHtml(r.role || getBoardRoleLabel(r) || dash)}</td>
            <td style="text-align:center">${escapeHtml(r.memberStateAtMeeting || dash)}</td>
            <td class="signature-cell"></td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="section-title">جدول الأعمال</div>
      <ol style="padding-right:20px;margin:8px 0 16px">
        ${(meeting?.agenda || []).filter(Boolean).map(item => `<li style="margin-bottom:6px;font-size:12px">${escapeHtml(item)}</li>`).join("") || "<li style='color:#94a3b8'>لا توجد بنود مسجلة</li>"}
      </ol>
      <div class="section-title">القرارات الصادرة</div>
      <table>
        <thead><tr><th>#</th><th>نص القرار</th><th>الحالة</th><th>موافق</th><th>معارض</th><th>ممتنع</th></tr></thead>
        <tbody>${decisionRows}</tbody>
      </table>` +
      (meeting?.notes ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px"><strong style="font-size:11px;color:#64748b">ملاحظات:</strong><p style="margin:4px 0 0;font-size:12px">${escapeHtml(meeting.notes)}</p></div>` : "") +
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:32px">
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">رئيس المجلس</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">الأمين العام</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">أمين الصندوق</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
      </div>` +
      closePrint
  );
  win.document.close();
};

const renderMemberAllowanceBody = (allowances, otherAllowances, total) => {
  let index = 0;
  const rows = [];
  const standard = [
    { label: "بدل الجلسات", val: allowances?.sessions || 0 },
    { label: "بدل الانتقال", val: allowances?.travel || 0 },
    { label: "بدل الضيافة", val: allowances?.hospitality || 0 },
  ];
  standard.forEach((item) => {
    index++;
    rows.push(`<tr><td style="text-align:center">${index}</td><td>${item.label}</td><td style="text-align:center">${formatMoney(item.val)}</td></tr>`);
  });
  (otherAllowances || []).forEach((o) => {
    index++;
    rows.push(`<tr><td style="text-align:center">${index}</td><td>${escapeHtml(o.category)}</td><td style="text-align:center">${formatMoney(o.amount || 0)}</td></tr>`);
  });
  return rows.join("");
};

export const printMemberAllowanceSheet = ({ member, allowances, otherAllowances, total, termInfo }) => {
  const win = openPrintWindow(`member-allowance-${member?.id || "sheet"}`);
  if (!win) return;

  win.document.write(
    printBase("كشف بدلات عضو مجلس", "portrait") +
      getPrintBrandHeader({
        reportTitle: "كشف البدلات الشهرية المعتمدة",
        reportMeta: `الدورة: ${escapeHtml(termInfo)}`,
      }) +
      `<div class="cards" style="grid-template-columns:repeat(2,1fr)">
        <div class="card"><div class="card-label">اسم العضو</div><div class="card-value" style="font-size:16px">${escapeHtml(member?.name || dash)}</div></div>
        <div class="card"><div class="card-label">الصفة</div><div class="card-value" style="font-size:16px">${escapeHtml(getBoardRoleLabel(member) || dash)}</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>نوع البدل</th><th>المبلغ</th></tr></thead>
        <tbody>${renderMemberAllowanceBody(allowances, otherAllowances, total)}</tbody>
        <tfoot>
          <tr class="total-row"><td colspan="2">الإجمالي المعتمد</td><td style="text-align:center">${formatMoney(total || 0)}</td></tr>
        </tfoot>
      </table>
      ${renderTafqeetRow(total || 0)}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:32px;margin-top:42px">
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">توقيع العضو</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">توقيع أمين الصندوق</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
      </div>
      <div style="margin-top:16px;text-align:center;color:#94a3b8;font-size:10px;font-weight:700">
        هذا الكشف معتمد من التسويات المالية للمجلس وجاهز للصرف
      </div>` +
      closePrint
  );
  win.document.close();
};

export const printAllMemberAllowanceSheets = ({ memberRows, termInfo }) => {
  const win = openPrintWindow("board-allowances-all");
  if (!win) return;

  const parts = memberRows.map(
    (row, idx) => `
    <div${idx > 0 ? ' style="page-break-before:always;padding-top:20px"' : ""}>
      <div class="cards" style="grid-template-columns:repeat(2,1fr)">
        <div class="card"><div class="card-label">اسم العضو</div><div class="card-value" style="font-size:16px">${escapeHtml(row.member?.name || dash)}</div></div>
        <div class="card"><div class="card-label">الصفة</div><div class="card-value" style="font-size:16px">${escapeHtml(getBoardRoleLabel(row.member) || dash)}</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>نوع البدل</th><th>المبلغ</th></tr></thead>
        <tbody>${renderMemberAllowanceBody(row.allowances, row.otherAllowances, row.total)}</tbody>
        <tfoot>
          <tr class="total-row"><td colspan="2">الإجمالي المعتمد</td><td style="text-align:center">${formatMoney(row.total || 0)}</td></tr>
        </tfoot>
      </table>
      ${renderTafqeetRow(row.total || 0)}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:32px;margin-top:32px">
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">توقيع العضو</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
        <div style="text-align:center">
          <div style="font-weight:900;color:#334155;font-size:11px">توقيع أمين الصندوق</div>
          <div style="height:48px;border-bottom:2px dashed #cbd5e1;margin-top:12px"></div>
        </div>
      </div>
      <hr style="margin-top:20px;border:none;border-top:2px solid #e2e8f0"/>
    </div>`
  );

  win.document.write(
    printBase("كشوف بدلات أعضاء مجلس الإدارة") +
      getPrintBrandHeader({
        reportTitle: "كشوف البدلات الشهرية المعتمدة",
        reportMeta: `الدورة: ${escapeHtml(termInfo)}`,
      }) +
      parts.join("") +
      closePrint
  );
  win.document.close();
};
