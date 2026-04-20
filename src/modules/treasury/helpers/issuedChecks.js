export const ISSUED_CHECK_TYPES = [
  { id: "aid", label: "إعانة", color: "rose", icon: "heart" },
  { id: "budget", label: "ميزانيات", color: "sky", icon: "wallet" },
  { id: "activities", label: "أنشطة", color: "amber", icon: "activity" },
  { id: "trip", label: "رحلات", color: "indigo", icon: "map" },
  { id: "event", label: "فاعليات", color: "orange", icon: "sparkles" },
  { id: "advance", label: "سلفة", color: "purple", icon: "user" },
  { id: "other", label: "أخرى", color: "slate", icon: "file" },
];

export const normalizeIssuedCheckType = (type = "") => {
  if (type === "care") return "aid";
  if (type === "activity") return "event";
  return type;
};

export const LEGACY_CHECK_TYPES = ["aid", "advance", "activity", "care"];
export const LEGACY_ISSUED_CHECK_PREFIX = "legacy_tx_";
export const DIRECT_FINANCE_TYPES = ["bank_charge"];
export const DIRECT_BANK_CHARGE_OPTIONS = [
  "مصاريف كشف حساب",
  "مصاريف استخراج دفتر شيكات",
  "مصاريف رسوم بريدية",
  "مصاريف وعمولات أخرى",
];

export const ISSUED_CHECK_TYPE_LABELS = Object.fromEntries(
  ISSUED_CHECK_TYPES.map((item) => [item.id, item.label])
);

export const EXTRA_FINANCE_TYPE_LABELS = {
  bank_charge: "خصم مباشر",
};

export const ISSUED_CHECK_TYPE_COLORS = Object.fromEntries(
  ISSUED_CHECK_TYPES.map((item) => [item.id, item.color])
);

export const OPTIONAL_SETTLEMENT_TYPES = ["budget", "activities", "other"];
export const EMPLOYEE_LOOKUP_TYPES = ["aid", "advance", "event", "trip"];
export const EVENT_DETAILS_TYPES = ["event", "trip"];

export const getDefaultRequiresSettlement = (type) => {
  const normalizedType = normalizeIssuedCheckType(type);
  if (normalizedType === "aid") return false;
  if (normalizedType === "advance" || normalizedType === "event" || normalizedType === "trip") return true;
  return false;
};

export const getSettlementMode = (type, requiresSettlement) => {
  const normalizedType = normalizeIssuedCheckType(type);
  if (!requiresSettlement) return "none";
  if (normalizedType === "advance") return "carry_forward";
  if (normalizedType === "trip") return "check_plus_subscriptions";
  return "check_only";
};

export const normalizeRequiresSettlement = (doc) =>
  Boolean(
    doc?.requires_settlement ??
      doc?.requiresSettlement ??
      getDefaultRequiresSettlement(doc?.type)
  );

export const getIssuedCheckTypeLabel = (type = "") =>
  ISSUED_CHECK_TYPE_LABELS[normalizeIssuedCheckType(type)] ||
  EXTRA_FINANCE_TYPE_LABELS[type] ||
  type ||
  "شيك";

export const getIssuedCheckDisplayParty = (doc) =>
  doc?.party ||
  doc?.beneficiaryName ||
  doc?.employeeName ||
  doc?.activityName ||
  doc?.eventName ||
  "";

export const isLegacyCheckType = (type = "") =>
  LEGACY_CHECK_TYPES.includes(type);

export const isDirectFinanceType = (type = "") =>
  DIRECT_FINANCE_TYPES.includes(type);

export const buildLegacyIssuedCheckId = (legacyId = "") =>
  legacyId ? `${LEGACY_ISSUED_CHECK_PREFIX}${legacyId}` : "";

const normalizeFingerprintValue = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const buildCheckFingerprint = (doc = {}) => {
  const party = getIssuedCheckDisplayParty(doc);
  return [
    normalizeIssuedCheckType(doc?.type),
    normalizeFingerprintValue(doc?.checkNum),
    normalizeFingerprintValue(doc?.date),
    Number(doc?.amount || 0),
    normalizeFingerprintValue(party),
  ].join("|");
};

export const isLegacyCheckMigrated = (legacyTx, issuedChecks = []) => {
  const legacyId = legacyTx?.id;
  if (!legacyId) return false;

  const migratedId = buildLegacyIssuedCheckId(legacyId);
  const legacyFingerprint = buildCheckFingerprint(legacyTx);
  return issuedChecks.some(
    (check) =>
      check?.id === migratedId ||
      check?.legacySourceId === legacyId ||
      check?.sourceTransactionId === legacyId ||
      buildCheckFingerprint(check) === legacyFingerprint
  );
};

export const getPendingLegacyCheckTransactions = (
  legacyTransactions = [],
  issuedChecks = []
) =>
  legacyTransactions.filter(
    (tx) => isLegacyCheckType(tx.type) && !isLegacyCheckMigrated(tx, issuedChecks)
  );

export const getLegacyChecksMigrationPreview = (
  legacyTransactions = [],
  issuedChecks = []
) => {
  const legacyChecks = legacyTransactions.filter((tx) => isLegacyCheckType(tx.type));
  const pendingTransactions = getPendingLegacyCheckTransactions(
    legacyTransactions,
    issuedChecks
  );

  return {
    totalLegacy: legacyChecks.length,
    pendingCount: pendingTransactions.length,
    alreadyMigrated: legacyChecks.length - pendingTransactions.length,
    pendingTransactions,
  };
};

export const excludeMigratedLegacyChecks = (
  legacyTransactions = [],
  issuedChecks = []
) =>
  legacyTransactions.filter(
    (tx) => !isLegacyCheckType(tx.type) || !isLegacyCheckMigrated(tx, issuedChecks)
  );

export const mergeIssuedChecksSources = (
  issuedChecks = [],
  legacyTransactions = []
) => {
  const normalizedIssuedChecks = issuedChecks.map((tx) => ({
    ...tx,
    type: normalizeIssuedCheckType(tx.type),
    sourceCollection: tx?.sourceCollection || "issued_checks",
  }));

  const pendingLegacyChecks = getPendingLegacyCheckTransactions(
    legacyTransactions,
    issuedChecks
  ).map((tx) => ({
    ...tx,
    type: normalizeIssuedCheckType(tx.type),
    sourceCollection: "transactions",
  }));

  return [...pendingLegacyChecks, ...normalizedIssuedChecks];
};

export const getIssuedCheckSourceKey = (doc = {}) => {
  const id = String(doc?.id || "");
  if (doc?.legacySourceId) return String(doc.legacySourceId);
  if (doc?.sourceTransactionId) return String(doc.sourceTransactionId);
  if (id.startsWith(LEGACY_ISSUED_CHECK_PREFIX)) {
    return id.slice(LEGACY_ISSUED_CHECK_PREFIX.length);
  }
  return id;
};

export const isGroupedSettlementFollower = (doc = {}) =>
  Boolean(
    doc?.settlementGroupFollower ||
      (doc?.settlementGroupLeaderId &&
        String(doc.settlementGroupLeaderId) !== String(doc.id || ""))
  );

const getIssuedCheckSortStamp = (doc = {}) =>
  String(doc?.updatedAt || doc?.settlementDate || doc?.date || "");

export const mergeIssuedChecksSourcesNormalized = (
  issuedChecks = [],
  legacyTransactions = []
) => {
  const grouped = new Map();

  mergeIssuedChecksSources(issuedChecks, legacyTransactions).forEach((doc) => {
    const key = getIssuedCheckSourceKey(doc);
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, doc);
      return;
    }

    if (current?.isSettled && !doc?.isSettled) {
      grouped.set(key, doc);
      return;
    }

    if (Boolean(current?.isSettled) === Boolean(doc?.isSettled)) {
      const currentStamp = getIssuedCheckSortStamp(current);
      const nextStamp = getIssuedCheckSortStamp(doc);

      if (nextStamp > currentStamp) {
        grouped.set(key, doc);
        return;
      }

      if (
        nextStamp === currentStamp &&
        current?.sourceCollection !== "issued_checks" &&
        doc?.sourceCollection === "issued_checks"
      ) {
        grouped.set(key, doc);
      }
    }
  });

  return Array.from(grouped.values());
};
