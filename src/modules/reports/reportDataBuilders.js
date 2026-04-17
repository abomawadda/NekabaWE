import {
  formatEmployeeDate,
  getRetirementDate,
  isBoardMember,
} from "../../utils/memberBenefits";
import {
  getIssuedCheckDisplayParty,
  getIssuedCheckTypeLabel,
  mergeIssuedChecksSources,
  normalizeIssuedCheckType,
  normalizeRequiresSettlement,
} from "../treasury/helpers/issuedChecks";
import {
  compareArabic,
  getBookingStatusLabel,
  getLatestSettlementExpenseDate,
  getRecordStateLabel,
  getSettlementModeLabel,
  toNumber,
} from "./reportUtils";

export const getBoardRoleWeight = (role = "", roles = []) => {
  const index = roles.indexOf(String(role || "").trim());
  return index >= 0 ? index : roles.length;
};

export const getIssuedCheckStatusLabel = (doc = {}) => {
  if (doc?.isSettled) return "تمت التسوية";
  if (normalizeRequiresSettlement(doc)) return "بانتظار التسوية";
  return "لا تتطلب تسوية";
};

export const buildTreasuryRows = (sourceData = {}) => {
  const merged = mergeIssuedChecksSources(
    sourceData.issued_checks || [],
    sourceData.transactions || []
  );

  return merged
    .filter((record) => !record?.state || record.state === "posted" || record.state === "approved")
    .map((record) => {
      const normalizedType = normalizeIssuedCheckType(record.type);
      const amount = toNumber(record.advanceAmountBase || record.amount);
      const isIncome = ["deposit", "refund", "subs"].includes(record.type);
      return {
        id: record.id,
        date: record.date || "",
        typeLabel: getIssuedCheckTypeLabel(normalizedType),
        reference: record.checkNum || record.bankReference || record.receiptNo || "—",
        party: getIssuedCheckDisplayParty(record) || "—",
        statement:
          record.notes ||
          record.activityName ||
          record.eventName ||
          record.expenseItem ||
          record.bankChargeCategory ||
          "—",
        income: isIncome ? amount : 0,
        expense: isIncome ? 0 : amount,
        statusLabel: getRecordStateLabel(record.state),
        __search: [
          record.date,
          record.checkNum,
          record.bankReference,
          getIssuedCheckDisplayParty(record),
          getIssuedCheckTypeLabel(normalizedType),
          record.notes,
          record.expenseItem,
          record.bankChargeCategory,
        ].filter(Boolean).join(" "),
      };
    });
};

export const buildIssuedChecksRows = (sourceData = {}) => {
  const merged = mergeIssuedChecksSources(
    sourceData.issued_checks || [],
    sourceData.transactions || []
  );

  return merged
    .filter((record) => !["deposit", "refund", "subs", "bank_charge"].includes(record.type))
    .map((record) => ({
      id: record.id,
      date: record.date || "",
      typeLabel: getIssuedCheckTypeLabel(normalizeIssuedCheckType(record.type)),
      reference: record.checkNum || "—",
      party: getIssuedCheckDisplayParty(record) || "—",
      amount: toNumber(record.advanceAmountBase || record.amount),
      settlementLabel: normalizeRequiresSettlement(record) ? "تتطلب تسوية" : "لا تتطلب تسوية",
      settlementStatusLabel: getIssuedCheckStatusLabel(record),
      settlementModeLabel: getSettlementModeLabel(record.settlement_mode || record.settlementMode || "none"),
      purpose:
        record.expenseItem ||
        record.aidCategory ||
        record.activityName ||
        record.eventName ||
        record.notes ||
        "—",
      __search: [
        record.date,
        record.checkNum,
        getIssuedCheckDisplayParty(record),
        record.expenseItem,
        record.aidCategory,
        record.activityName,
        record.notes,
      ].filter(Boolean).join(" "),
    }));
};

export const buildSettlementRows = (sourceData = {}) => {
  const merged = mergeIssuedChecksSources(
    sourceData.issued_checks || [],
    sourceData.transactions || []
  );

  return merged
    .filter(
      (record) =>
        Boolean(record?.isSettled) ||
        (Array.isArray(record?.settlementExpenses) && record.settlementExpenses.length > 0)
    )
    .map((record) => ({
      id: record.id,
      approvalDate: getLatestSettlementExpenseDate(
        record.settlementExpenses,
        record.settlementDate || record.date || ""
      ),
      checkDate: record.date || "",
      typeLabel: getIssuedCheckTypeLabel(normalizeIssuedCheckType(record.type)),
      reference: record.checkNum || "—",
      party: getIssuedCheckDisplayParty(record) || "—",
      checkAmount: toNumber(record.advanceAmountBase || record.amount),
      spent: toNumber(record.settlementSpent),
      returned: toNumber(record.settlementReturned),
      invoicesCount: Array.isArray(record.settlementExpenses) ? record.settlementExpenses.length : 0,
      settlementModeLabel: getSettlementModeLabel(record.settlement_mode || record.settlementMode || "none"),
      returnStatus: record.returnedActually ? "رُد نقدًا" : "مرحل لاحقًا",
      __search: [
        record.settlementDate,
        record.date,
        record.checkNum,
        getIssuedCheckDisplayParty(record),
        record.notes,
      ].filter(Boolean).join(" "),
    }));
};

export const buildBankChargesRows = (sourceData = {}) =>
  (sourceData.transactions || [])
    .filter((record) => record.type === "bank_charge")
    .map((record) => ({
      id: record.id,
      date: record.date || "",
      category: record.bankChargeCategory || "خصم بنكي",
      reference: record.bankReference || "—",
      amount: toNumber(record.amount),
      statement: record.notes || "—",
      statusLabel: getRecordStateLabel(record.state),
      __search: [
        record.date,
        record.bankChargeCategory,
        record.bankReference,
        record.notes,
      ].filter(Boolean).join(" "),
    }));

export const buildAidsRows = (sourceData = {}) => {
  const merged = mergeIssuedChecksSources(
    sourceData.issued_checks || [],
    sourceData.transactions || []
  );

  return merged
    .filter((record) => normalizeIssuedCheckType(record.type) === "aid")
    .map((record) => ({
      id: record.id,
      date: record.date || "",
      memberName: getIssuedCheckDisplayParty(record) || "—",
      memberId: record.employeeId || record.jobId || "—",
      category: record.aidCategory || "إعانة",
      relation: record.aidRel || "—",
      incidentDate: record.incidentDate || "—",
      amount: toNumber(record.advanceAmountBase || record.amount),
      reference: record.checkNum || "—",
      statusLabel: getIssuedCheckStatusLabel(record),
      __search: [
        record.date,
        record.employeeId,
        record.party,
        record.employeeName,
        record.aidCategory,
        record.aidRel,
        record.checkNum,
      ].filter(Boolean).join(" "),
    }));
};

export const buildEmployeesRows = (sourceData = {}) =>
  (sourceData.employees || []).map((member) => ({
    id: member.id,
    jobId: member.jobId || "—",
    name: member.name || "—",
    membershipStatus: member.membershipStatus || "—",
    memberState: member.memberState || "—",
    jobTitle: member.jobTitle || "—",
    workplace: member.workplace || "—",
    phone: member.phone || member.mobile || "—",
    subscriptionStatus: member.subscriptionStatus || "—",
    retirementDate: formatEmployeeDate(getRetirementDate(member)) || "—",
    __search: [
      member.jobId,
      member.name,
      member.membershipStatus,
      member.jobTitle,
      member.workplace,
      member.phone,
    ].filter(Boolean).join(" "),
  }));

export const buildBoardMembersRows = (sourceData = {}) =>
  (sourceData.employees || [])
    .filter((member) => isBoardMember(member))
    .map((member) => ({
      id: member.id,
      role: member.membershipStatus || "—",
      name: member.name || "—",
      jobId: member.jobId || "—",
      phone: member.phone || member.mobile || "—",
      specialization: member.specialization || "—",
      workplace: member.workplace || "—",
      memberState: member.memberState || "—",
      __search: [
        member.membershipStatus,
        member.name,
        member.jobId,
        member.specialization,
        member.workplace,
      ].filter(Boolean).join(" "),
    }));

export const buildBoardMeetingsRows = (sourceData = {}) => {
  const membersMap = new Map(
    (sourceData.employees || []).map((member) => [member.id, member.name || "—"])
  );

  return (sourceData.board_meetings || []).map((meeting) => ({
    id: meeting.id,
    date: meeting.date || "",
    title: meeting.title || "—",
    statusLabel: meeting.status === "held" ? "منعقد" : meeting.status === "cancelled" ? "ملغي" : "مجدول",
    attendeesCount: Array.isArray(meeting.attendees) ? meeting.attendees.length : 0,
    decisionsCount: Array.isArray(meeting.decisions) ? meeting.decisions.length : 0,
    attendeesNames:
      (meeting.attendees || [])
        .map((id) => membersMap.get(id) || "—")
        .filter(Boolean)
        .join("، ") || "—",
    __search: [
      meeting.date,
      meeting.title,
      meeting.status,
      (meeting.attendees || []).map((id) => membersMap.get(id) || "").join(" "),
    ].filter(Boolean).join(" "),
  }));
};

export const buildBoardAllowancesRows = (sourceData = {}, boardRoles = []) => {
  const boardMembers = (sourceData.employees || []).filter((member) => isBoardMember(member));
  const merged = mergeIssuedChecksSources(
    sourceData.issued_checks || [],
    sourceData.transactions || []
  );

  const rowsMap = new Map(
    boardMembers.map((member) => [
      member.id,
      {
        id: member.id,
        role: member.membershipStatus || "—",
        name: member.name || "—",
        sessionsAllowance: 0,
        travelAllowance: 0,
        hospitalityAllowance: 0,
        totalAllowance: 0,
        lastAllowanceDate: "",
      },
    ])
  );

  merged
    .filter((record) => Boolean(record?.isSettled))
    .forEach((record) => {
      (record.settlementExpenses || []).forEach((expense) => {
        if (!Array.isArray(expense.boardMembers) || expense.boardMembers.length === 0) return;
        const perMember =
          toNumber(expense.allowancePerMember) ||
          toNumber(expense.amount) / Math.max(expense.boardMembers.length, 1);
        expense.boardMembers.forEach((memberId) => {
          const row = rowsMap.get(memberId);
          if (!row) return;
          if (expense.category === "بدل جلسات") row.sessionsAllowance += perMember;
          if (expense.category === "بدل انتقال") row.travelAllowance += perMember;
          if (["بدل ضيافة", "ضيافة وبوفيه"].includes(expense.category)) {
            row.hospitalityAllowance += perMember;
          }
          row.totalAllowance =
            row.sessionsAllowance + row.travelAllowance + row.hospitalityAllowance;
          const expenseDate = expense.date || record.settlementDate || record.date || "";
          if (compareArabic(expenseDate, row.lastAllowanceDate) > 0) {
            row.lastAllowanceDate = expenseDate;
          }
        });
      });
    });

  return Array.from(rowsMap.values()).map((row) => ({
    ...row,
    roleWeight: getBoardRoleWeight(row.role, boardRoles),
    __search: [row.role, row.name, row.lastAllowanceDate].filter(Boolean).join(" "),
  }));
};

export const buildEventsRows = (sourceData = {}, todayValue = "") =>
  (sourceData.events || []).map((event) => {
    const booked = toNumber(event.bookedCount);
    const capacity = Math.max(toNumber(event.capacity), 0);
    const available = Math.max(capacity - booked, 0);
    const today = todayValue || "";
    const statusLabel =
      event.date < today
        ? "منتهية"
        : today >= (event.bookingStart || "") && today <= (event.bookingEnd || "")
          ? "الحجز مفتوح"
          : today < (event.bookingStart || "")
            ? "قريبًا"
            : "الحجز مغلق";

    return {
      id: event.id,
      date: event.date || "",
      title: event.title || "—",
      type: event.type || "—",
      location: event.location || "—",
      capacity,
      booked,
      available,
      bookingWindow: `${event.bookingStart || "—"} → ${event.bookingEnd || "—"}`,
      pricing: event.isFree
        ? "مجانية"
        : `عضو ${event.memberPrice || 0} | مرافق ${event.companionPrice || 0} | دعم ${event.memberSupportValue || 0}`,
      statusLabel,
      __search: [event.date, event.title, event.type, event.location].filter(Boolean).join(" "),
    };
  });

export const buildBookingsRows = (sourceData = {}) => {
  const eventsMap = new Map((sourceData.events || []).map((event) => [event.id, event]));

  return (sourceData.event_bookings || []).map((booking) => {
    const linkedEvent = eventsMap.get(booking.eventId) || {};
    const createdAtLabel =
      booking.createdAt?.toDate?.()?.toISOString?.().split("T")[0] ||
      (booking.createdAt?.seconds
        ? new Date(booking.createdAt.seconds * 1000).toISOString().split("T")[0]
        : "—");

    return {
      id: booking.id,
      eventDate: booking.eventDate || linkedEvent.date || "",
      eventTitle: booking.eventTitle || linkedEvent.title || "—",
      memberName: booking.memberName || "—",
      memberId: booking.memberId || "—",
      totalPax: toNumber(booking.totalPax || 1),
      totalCost: toNumber(booking.totalCost),
      statusLabel: getBookingStatusLabel(booking.status),
      paymentSummary: booking.paymentSummary || "—",
      createdAtLabel,
      __search: [
        booking.eventTitle,
        linkedEvent.title,
        booking.memberName,
        booking.memberId,
        booking.paymentSummary,
        booking.status,
      ].filter(Boolean).join(" "),
    };
  });
};

export const buildMemberBenefitsRows = (sourceData = {}) =>
  (sourceData.member_benefits || []).map((entry) => ({
    id: entry.id,
    date: entry.date || "",
    memberName: entry.memberName || "—",
    memberId: entry.memberId || "—",
    benefitType: entry.benefitType || "ميزة صندوق",
    amount: toNumber(entry.amount),
    eventTitle: entry.eventTitle || "—",
    sourceLabel: entry.source || "—",
    statusLabel: entry.status === "cancelled" ? "ملغي" : "نشط",
    notes: entry.notes || entry.displayLabel || "—",
    __search: [
      entry.date,
      entry.memberName,
      entry.memberId,
      entry.benefitType,
      entry.eventTitle,
      entry.notes,
      entry.displayLabel,
    ].filter(Boolean).join(" "),
  }));
