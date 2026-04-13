export const BOARD_MEMBERSHIP_ROLES = [
  "رئيس المجلس",
  "النقيب العام",
  "الأمين العام",
  "أمين الصندوق",
  "عضو مجلس إدارة",
  "عضو مجلس",
  "نائب الرئيس",
];

export const NON_ALLOWANCE_BENEFIT_TYPES = [
  "دعم فعالية",
  "خصم إشراف فعالية",
  "إعفاء إشراف فعالية",
  "جائزة مسابقة",
  "خدمة عينية",
  "ميزة تنظيمية",
  "إعفاء",
];

export const isIndependentMember = (member) =>
  String(member?.membershipStatus || "").trim() === "نقابة مستقلة";

export const isBoardMember = (member) =>
  BOARD_MEMBERSHIP_ROLES.includes(String(member?.membershipStatus || "").trim());

export const isEligibleForBenefit = (member) => !isIndependentMember(member);

export const parseEmployeeBirthDate = (birthDateStr) => {
  if (!birthDateStr) return null;
  const value = String(birthDateStr).trim();

  if (value.includes("-")) {
    const [year, month, day] = value.split("-");
    const parsed = new Date(Number(year), Number(month) - 1, Number(String(day).slice(0, 2)));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value.includes("/")) {
    const [day, month, year] = value.split("/").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const getEmployeeAge = (member) => {
  const birthDate = parseEmployeeBirthDate(member?.birthDate || member?.dateOfBirth);
  if (!birthDate) return -1;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

const normalizeJobId = (value) => String(value ?? "").trim();

const jobIdSortValue = (value) => {
  const normalized = normalizeJobId(value).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && normalized !== "" ? numeric : Number.MAX_SAFE_INTEGER;
};

export const compareMembersByAgeThenJobId = (a, b) => {
  const ageDiff = getEmployeeAge(b) - getEmployeeAge(a);
  if (ageDiff !== 0) return ageDiff;

  const jobDiff = jobIdSortValue(a?.jobId) - jobIdSortValue(b?.jobId);
  if (jobDiff !== 0) return jobDiff;

  return normalizeJobId(a?.jobId).localeCompare(normalizeJobId(b?.jobId), "ar");
};

export const sortMembersByAgeThenJobId = (members = []) =>
  [...members].sort(compareMembersByAgeThenJobId);

export const createBenefitLabel = ({ benefitType, eventTitle, notes }) =>
  [benefitType, eventTitle ? `المرجع: ${eventTitle}` : "", notes].filter(Boolean).join(" - ");
