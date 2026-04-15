const normalizeArabicDigits = (value = "") =>
  String(value).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));

export const toNumericValue = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = normalizeArabicDigits(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatMoney = (value) => {
  const numericValue = toNumericValue(value);
  const hasFraction = Math.abs(numericValue - Math.trunc(numericValue)) > 0.000001;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(numericValue);
};

export const formatMoneyOrDash = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return formatMoney(value);
};
