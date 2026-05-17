import {
  formatEmployeeDate,
  getBoardRoleLabel,
  getEffectiveMemberState,
  getMembershipEndDate,
  getRetirementDate,
  isBoardMember,
  parseEmployeeDate,
} from "../../utils/memberBenefits";

export const BOARD_TERMS_COLLECTION = "board_terms";
export const BOARD_MEMBERSHIPS_COLLECTION = "board_memberships";
export const BOARD_MEETINGS_COLLECTION = "board_meetings";
export const VIRTUAL_ACTIVE_TERM_ID = "__legacy_active_term__";

const normalizeText = (value = "") => String(value || "").trim();

const toDateValue = (value) => parseEmployeeDate(value) || null;

const toIsoDate = (value) => {
  const parsed = toDateValue(value);
  if (!parsed) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const getSortDate = (value = "") => {
  const parsed = toDateValue(value);
  return parsed ? parsed.getTime() : 0;
};

export const sortBoardTerms = (terms = []) =>
  [...terms].sort((a, b) => getSortDate(b.startDate) - getSortDate(a.startDate));

export const normalizeBoardTerm = (term = {}, fallback = {}) => ({
  ...term,
  id: normalizeText(term.id),
  title: normalizeText(term.title) || normalizeText(fallback.title),
  termNumber: term.termNumber ?? fallback.termNumber ?? "",
  startDate: toIsoDate(term.startDate || fallback.startDate),
  endDate: toIsoDate(term.endDate || fallback.endDate),
  electionDate: toIsoDate(term.electionDate || fallback.electionDate),
  approvalDate: toIsoDate(term.approvalDate || fallback.approvalDate),
  approvalRef: normalizeText(term.approvalRef || fallback.approvalRef),
  status: normalizeText(term.status || fallback.status) || "planned",
  notes: normalizeText(term.notes || fallback.notes),
  targetSeats: term.targetSeats ?? fallback.targetSeats ?? "",
  isVirtual: Boolean(term.isVirtual || fallback.isVirtual),
});

export const getVirtualBoardTerm = ({
  startDate = "",
  endDate = "",
  title = "الدورة الحالية",
  targetSeats = 11,
} = {}) =>
  normalizeBoardTerm(
    {
      id: VIRTUAL_ACTIVE_TERM_ID,
      title,
      startDate,
      endDate,
      status: "active",
      targetSeats,
      isVirtual: true,
    },
    {}
  );

export const getActiveBoardTerm = (terms = [], fallback = {}) => {
  const normalized = sortBoardTerms(terms.map((term) => normalizeBoardTerm(term)));
  const active = normalized.find((term) => term.status === "active");
  if (active) return active;
  const latest = normalized[0];
  if (latest) return latest;
  return getVirtualBoardTerm(fallback);
};

export const buildBoardMembershipSnapshot = (member = {}) => ({
  name: normalizeText(member.name),
  jobId: normalizeText(member.jobId),
  jobTitle: normalizeText(member.jobTitle),
  workplace: normalizeText(member.workplace),
  phone: normalizeText(member.phone || member.mobile),
  memberState: normalizeText(member.memberState),
  membershipStatus: normalizeText(member.membershipStatus),
  specialization: normalizeText(member.specialization),
});

export const normalizeBoardMembership = (membership = {}) => ({
  ...membership,
  id: normalizeText(membership.id),
  termId: normalizeText(membership.termId),
  memberId: normalizeText(membership.memberId),
  memberJobId: normalizeText(membership.memberJobId),
  memberName: normalizeText(membership.memberName),
  role: normalizeText(membership.role),
  roleOrder: membership.roleOrder ?? 99,
  joinDate: toIsoDate(membership.joinDate),
  endDate: toIsoDate(membership.endDate),
  status: normalizeText(membership.status) || "active",
  joinMethod: normalizeText(membership.joinMethod) || "legacy",
  endReason: normalizeText(membership.endReason),
  decisionDate: toIsoDate(membership.decisionDate),
  decisionRef: normalizeText(membership.decisionRef),
  replacementForMembershipId: normalizeText(membership.replacementForMembershipId),
  escalationSourceMemberId: normalizeText(membership.escalationSourceMemberId),
  notes: normalizeText(membership.notes),
  snapshot: membership.snapshot || {},
});

export const isBoardMembershipActiveOnDate = (membership = {}, onDate = new Date()) => {
  const normalized = normalizeBoardMembership(membership);
  if (normalized.status === "vacated") return false;

  const referenceDate = toDateValue(onDate) || new Date();
  const joinDate = toDateValue(normalized.joinDate);
  const endDate = toDateValue(normalized.endDate);

  if (joinDate && joinDate.getTime() > referenceDate.getTime()) return false;
  if (endDate && endDate.getTime() < referenceDate.getTime()) return false;
  return true;
};

export const buildLegacyBoardMemberships = (employees = [], term = null) =>
  employees
    .filter((employee) => isBoardMember(employee))
    .map((employee, index) => {
      const retirementDate = getRetirementDate(employee);
      const membershipEndDate = getMembershipEndDate(employee);
      const resolvedEndDate = retirementDate || membershipEndDate;
      const joinDate = term?.startDate || "";
      const endDate = formatEmployeeDate(resolvedEndDate)
        ? toIsoDate(resolvedEndDate)
        : normalizeText(employee.boardMembershipEndDate || employee.membershipExpiry);
      const role = getBoardRoleLabel(employee);

      return normalizeBoardMembership({
        id: `legacy_${employee.id || employee.jobId || index}`,
        termId: term?.id || VIRTUAL_ACTIVE_TERM_ID,
        memberId: employee.id,
        memberJobId: employee.jobId || "",
        memberName: employee.name || "",
        role,
        joinDate,
        endDate,
        status: endDate ? "ended" : "active",
        joinMethod: "legacy",
        snapshot: buildBoardMembershipSnapshot(employee),
      });
    });

export const buildBoardMemberView = (membership = {}, member = {}) => {
  const normalizedMembership = normalizeBoardMembership(membership);
  const snapshot = normalizedMembership.snapshot || {};

  return {
    ...snapshot,
    ...member,
    id: normalizeText(member.id || normalizedMembership.memberId),
    name: normalizeText(member.name || normalizedMembership.memberName || snapshot.name),
    jobId: normalizeText(member.jobId || normalizedMembership.memberJobId || snapshot.jobId),
    workplace: normalizeText(member.workplace || snapshot.workplace),
    jobTitle: normalizeText(member.jobTitle || snapshot.jobTitle),
    specialization: normalizeText(member.specialization || snapshot.specialization),
    phone: normalizeText(member.phone || member.mobile || snapshot.phone),
    boardRoleTitle: normalizeText(normalizedMembership.role || member.boardRoleTitle || getBoardRoleLabel(member)),
    membershipStatus: normalizeText(normalizedMembership.role || member.membershipStatus || snapshot.membershipStatus),
    memberState: normalizeText(member.memberState || snapshot.memberState),
    boardMembership: normalizedMembership,
    boardMembershipId: normalizedMembership.id,
    boardTermId: normalizedMembership.termId,
  };
};

export const buildBoardMemberViewsFromMemberships = (
  memberships = [],
  employees = [],
  { termId = "" } = {}
) => {
  const employeesMap = new Map((employees || []).map((employee) => [normalizeText(employee.id), employee]));

  return memberships
    .filter((membership) => !termId || normalizeText(membership.termId) === normalizeText(termId))
    .map((membership) =>
      buildBoardMemberView(
        membership,
        employeesMap.get(normalizeText(membership.memberId)) || {}
      )
    );
};

export const getEligibleBoardMemberViews = ({
  memberships = [],
  employees = [],
  termId = "",
  onDate = new Date(),
} = {}) =>
  buildBoardMemberViewsFromMemberships(memberships, employees, { termId }).filter((membership) =>
    isBoardMembershipActiveOnDate(membership.boardMembership || membership, onDate)
  );

export const getMeetingAttendanceRecords = (meeting = {}) =>
  Array.isArray(meeting?.attendanceRecords)
    ? meeting.attendanceRecords.map((record) => ({
        membershipId: normalizeText(record.membershipId),
        memberId: normalizeText(record.memberId),
        memberName: normalizeText(record.memberName),
        role: normalizeText(record.role),
        memberStateAtMeeting: normalizeText(record.memberStateAtMeeting),
        attendanceStatus: normalizeText(record.attendanceStatus) || "present",
        jobId: normalizeText(record.jobId),
        workplace: normalizeText(record.workplace),
        jobTitle: normalizeText(record.jobTitle),
        notes: normalizeText(record.notes),
      }))
    : [];

export const getMeetingAttendeeIds = (meeting = {}) => {
  const recordIds = getMeetingAttendanceRecords(meeting)
    .map((record) => normalizeText(record.memberId))
    .filter(Boolean);

  if (recordIds.length > 0) return recordIds;

  return Array.isArray(meeting?.attendees)
    ? meeting.attendees.map((memberId) => normalizeText(memberId)).filter(Boolean)
    : [];
};

export const buildAttendanceRecord = ({
  member = {},
  membership = null,
  meetingDate = new Date(),
} = {}) => {
  const resolvedRole =
    normalizeText(membership?.role) ||
    normalizeText(member.boardRoleTitle) ||
    getBoardRoleLabel(member);

  return {
    membershipId: normalizeText(membership?.id),
    memberId: normalizeText(member.id || membership?.memberId),
    memberName:
      normalizeText(member.name || membership?.memberName || membership?.snapshot?.name) || "—",
    role: resolvedRole,
    memberStateAtMeeting: getEffectiveMemberState(member, meetingDate),
    attendanceStatus: "present",
    jobId: normalizeText(member.jobId || membership?.memberJobId || membership?.snapshot?.jobId),
    workplace: normalizeText(member.workplace || membership?.snapshot?.workplace),
    jobTitle: normalizeText(member.jobTitle || membership?.snapshot?.jobTitle),
    notes: "",
  };
};

export const buildMeetingAttendancePayload = ({
  selectedMemberIds = [],
  existingMeeting = {},
  eligibleMembers = [],
  allEmployees = [],
  termId = "",
  meetingDate = new Date(),
} = {}) => {
  const employeesMap = new Map((allEmployees || []).map((employee) => [normalizeText(employee.id), employee]));
  const eligibleMap = new Map(
    (eligibleMembers || []).map((member) => [
      normalizeText(member.id),
      member,
    ])
  );
  const existingRecordsMap = new Map(
    getMeetingAttendanceRecords(existingMeeting).map((record) => [normalizeText(record.memberId), record])
  );

  const attendeeIds = selectedMemberIds.map((memberId) => normalizeText(memberId)).filter(Boolean);
  const attendanceRecords = attendeeIds.map((memberId) => {
    const existingRecord = existingRecordsMap.get(memberId);
    if (existingRecord) return existingRecord;

    const eligibleMember = eligibleMap.get(memberId);
    if (eligibleMember) {
      return buildAttendanceRecord({
        member: eligibleMember,
        membership: eligibleMember.boardMembership,
        meetingDate,
      });
    }

    const employee = employeesMap.get(memberId) || {};
    return buildAttendanceRecord({
      member: employee,
      membership: null,
      meetingDate,
    });
  });

  return {
    termId: normalizeText(existingMeeting.termId || termId),
    attendees: attendeeIds,
    attendanceRecords,
  };
};
