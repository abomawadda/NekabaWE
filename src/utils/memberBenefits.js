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

export const normalizeArabicDigits = (value = "") =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit));

const RETIREMENT_AGE_PHASES = [
  { effectiveDate: "2032-07-01", age: 61 },
  { effectiveDate: "2034-07-01", age: 62 },
  { effectiveDate: "2036-07-01", age: 63 },
  { effectiveDate: "2038-07-01", age: 64 },
  { effectiveDate: "2040-07-01", age: 65 },
];

export const parseEmployeeDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = normalizeArabicDigits(value).trim();

  if (normalized.includes("-")) {
    const [year, month, day] = normalized.split("-");
    const parsed = new Date(Number(year), Number(month) - 1, Number(String(day).slice(0, 2)));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (normalized.includes("/")) {
    const [day, month, year] = normalized.split("/").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const getBirthDateFromNationalId = (nationalId) => {
  const value = normalizeArabicDigits(nationalId).replace(/\D/g, "");
  if (value.length !== 14) return null;

  const centuryDigit = value[0];
  const century = centuryDigit === "2" ? "19" : centuryDigit === "3" ? "20" : null;
  if (!century) return null;

  const year = Number(`${century}${value.slice(1, 3)}`);
  const month = Number(value.slice(3, 5));
  const day = Number(value.slice(5, 7));
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const getEmployeeBirthDate = (member) =>
  parseEmployeeDate(member?.birthDate || member?.dateOfBirth || member?.dob || member?.nationalBirthDate) ||
  getBirthDateFromNationalId(member?.nationalId);

export const formatEmployeeDate = (value) => {
  const parsed = parseEmployeeDate(value);
  if (!parsed) return "";
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
};

const addYears = (date, years) =>
  new Date(date.getFullYear() + years, date.getMonth(), date.getDate());

export const getLegalRetirementAge = (member) => {
  const birthDate = getEmployeeBirthDate(member);
  if (!birthDate) return null;

  let retirementDate = addYears(birthDate, 60);
  let retirementAge = 60;

  RETIREMENT_AGE_PHASES.forEach((phase) => {
    const phaseDate = parseEmployeeDate(phase.effectiveDate);
    if (retirementDate && phaseDate && retirementDate.getTime() >= phaseDate.getTime()) {
      retirementAge = phase.age;
      retirementDate = addYears(birthDate, phase.age);
    }
  });

  return retirementAge;
};

export const getLegalRetirementDate = (member) => {
  const birthDate = getEmployeeBirthDate(member);
  if (!birthDate) return null;

  let retirementDate = addYears(birthDate, 60);

  RETIREMENT_AGE_PHASES.forEach((phase) => {
    const phaseDate = parseEmployeeDate(phase.effectiveDate);
    if (retirementDate && phaseDate && retirementDate.getTime() >= phaseDate.getTime()) {
      retirementDate = addYears(birthDate, phase.age);
    }
  });

  return retirementDate;
};

export const getRetirementDate = (member) =>
  getLegalRetirementDate(member) ||
  parseEmployeeDate(member?.retirementDate || member?.retiredAt || member?.retireDate);

export const getDeathDate = (member) =>
  parseEmployeeDate(member?.deathDate || member?.dateOfDeath || member?.deceasedAt);

export const isDeceasedMember = (member, onDate = new Date()) => {
  const state = String(member?.memberState || "").trim();
  const deathDate = getDeathDate(member);
  const effectiveDate = stripTime(parseEmployeeDate(onDate) || new Date(onDate));

  if (deathDate) {
    return stripTime(deathDate).getTime() <= effectiveDate.getTime();
  }

  return state === "وفاة";
};

const stripTime = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isRetiredMember = (member, onDate = new Date()) => {
  const state = String(member?.memberState || "").trim();
  const retirementDate = getRetirementDate(member);
  const effectiveDate = stripTime(parseEmployeeDate(onDate) || new Date(onDate));

  if (retirementDate) {
    return stripTime(retirementDate).getTime() <= effectiveDate.getTime();
  }

  return state === "معاش";
};

export const isEligibleForBenefit = (member, onDate = new Date()) =>
  !isIndependentMember(member) && !isRetiredMember(member, onDate) && !isDeceasedMember(member, onDate);

export const parseEmployeeBirthDate = (birthDateStr) => parseEmployeeDate(birthDateStr);

export const getEmployeeAge = (member) => {
  const birthDate = getEmployeeBirthDate(member);
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
