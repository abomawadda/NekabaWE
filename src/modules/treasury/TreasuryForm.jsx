/**
 * TreasuryForm — نموذج إصدار المستندات المالية
 * - إصلاح مشكلة ظهور التقويم خلف التابات/الهيدر عبر ArabicDatePicker باستخدام Portal
 * - السماح بتعديل المبلغ بعد اقتراحه في الرعاية
 * - إضافة زر استعادة المبلغ المقترح
 * - تحسين التحقق من الأرقام والتجربة البصرية
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import WorkflowStepper from "./WorkflowStepper";
import { printVoucher, printAidRequest } from "./VoucherPrint";
import FileUpload from "./FileUpload";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import DynamicSelect from "../../ui/inputs/DynamicSelect";
import {
  DIRECT_BANK_CHARGE_OPTIONS,
  EVENT_DETAILS_TYPES,
  EMPLOYEE_LOOKUP_TYPES,
  getDefaultRequiresSettlement,
  getIssuedCheckTypeLabel,
  getSettlementMode,
  ISSUED_CHECK_TYPE_COLORS,
  ISSUED_CHECK_TYPE_LABELS,
  ISSUED_CHECK_TYPES,
  normalizeIssuedCheckType,
  OPTIONAL_SETTLEMENT_TYPES,
} from "./helpers/issuedChecks";

import {
  Search, Loader2, CheckCircle2, Printer, Landmark,
  FileText, User, Heart, Building, AlertCircle, Hash,
  DollarSign, UserCheck, Users, MapPin, Tag,
  Activity, X, Info, RotateCcw, Wallet, Sparkles
} from "lucide-react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useLocation } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import { formatEmployeeDate, getRetirementDate, isEligibleForBenefit, isRetiredMember, sortMembersByAgeThenJobId } from "../../utils/memberBenefits";
import clsx from "clsx";

// ─────────────────────────────────────────────
// ثوابت
// ─────────────────────────────────────────────
const AID_RELS = {
  "رعاية زواج": ["العضو نفسه", "ابن", "ابنة"],
  "رعاية وفاة": ["العضو نفسه", "الزوج", "الزوجة", "أب", "أم", "ابن", "ابنة"],
  "ظروف قهرية / صحية": ["العضو نفسه"],
  "مناسبات": ["ميزانيات", "دور وطني", "جوائز مسابقات", "مبادرات"],
};

const AID_AMOUNTS = {
  "رعاية وفاة:العضو نفسه": 500,
  "رعاية وفاة:الزوج": 500,
  "رعاية وفاة:الزوجة": 500,
  "رعاية وفاة:أب": 300,
  "رعاية وفاة:أم": 300,
  "رعاية وفاة:ابن": 300,
  "رعاية وفاة:ابنة": 300,
  "رعاية زواج:العضو نفسه": 500,
  "رعاية زواج:ابن": 300,
  "رعاية زواج:ابنة": 300,
  "ظروف قهرية / صحية:العضو نفسه": 300,
};

const ACTIVITY_TYPES = [
  "رحلة ترفيهية",
  "رحلة دينية",
  "إفطار جماعي",
  "حفل تكريم",
  "مسابقة رياضية",
  "مسابقة ثقافية",
  "احتفالية سنوية",
  "ندوة / محاضرة",
  "أخرى"
];

const EXPENSE_ITEM_OPTIONS = ["ميزانية تشغيل", "دعم نشاط", "مصروف إداري", "مخصص لجنة", "بند خاص", "أخرى"];

const getTodayISO = () => new Date().toISOString().split("T")[0];

const normalizeNumericInput = (value = "") =>
  String(value).replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const normalizeIntegerInput = (value = "") =>
  String(value).replace(/[^\d]/g, "");

const formatMoney = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ar-EG");
};

// ─────────────────────────────────────────────
// مكونات مساعدة
// ─────────────────────────────────────────────
function ERPSection({ title, icon: Icon, colorClass = "teal", children, badge }) {
  const T = useT();
  return (
    <div
      className={clsx(
        "p-4 rounded-2xl border shadow-sm space-y-3 animate-in fade-in duration-500 relative z-0",
        T.card
      )}
    >
      <div className="flex items-center justify-between border-b pb-2.5 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-teal-500 to-teal-600 rounded-full"></div>
          <div className={clsx("p-1.5 rounded-lg", `bg-${colorClass}-500/10`)}>
            <Icon size={14} className={`text-${colorClass}-600`} />
          </div>
          <h3 className={clsx("font-black text-[11px] uppercase tracking-widest", T.text)}>
            {title}
          </h3>
        </div>

        {badge && (
          <span
            className={clsx(
              "text-[9px] font-black px-2 py-0.5 rounded-full border",
              `bg-${colorClass}-50 text-${colorClass}-700 border-${colorClass}-200`,
              "dark:bg-opacity-20 dark:text-opacity-90"
            )}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function ERPInput({
  label,
  icon: Icon,
  error,
  isNumeric,
  hint,
  required,
  fullWidth,
  footer,
  ...props
}) {
  const T = useT();

  return (
    <div className={clsx("space-y-1 relative w-full", fullWidth && "sm:col-span-2")}>
      <label className="text-[10px] font-black text-slate-500 uppercase pr-1 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>

      {hint && <p className="text-[9px] text-teal-500 font-bold -mt-0.5 pr-1">{hint}</p>}

      <div className="relative group">
        {Icon && (
          <Icon
            size={14}
            className={clsx(
              "absolute right-3 top-2.5 z-10 transition-colors pointer-events-none",
              error ? "text-rose-500" : "text-slate-400 group-focus-within:text-teal-500"
            )}
          />
        )}

        <input
          {...props}
          inputMode={isNumeric ? "numeric" : "text"}
          className={clsx(
            "w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none transition-all h-[38px]",
            Icon ? "pr-9" : "pr-3",
            props.disabled
              ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-70 cursor-not-allowed"
              : clsx(T.inp, "focus:ring-2 focus:border-teal-500"),
            error && "!border-rose-500 bg-rose-50/10 focus:ring-rose-300"
          )}
        />
      </div>

      {footer}

      {error && (
        <p className="text-[9px] text-rose-500 font-black mt-0.5 flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

function ERPSelect({ label, icon: Icon, error, required, fullWidth, children, ...props }) {
  const T = useT();

  return (
    <div className={clsx("space-y-1 relative w-full", fullWidth && "sm:col-span-2")}>
      <label className="text-[10px] font-black text-slate-500 uppercase pr-1 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={14}
            className="absolute right-3 top-2.5 text-slate-400 pointer-events-none z-10"
          />
        )}

        <select
          {...props}
          className={clsx(
            "w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none h-[38px] transition-all",
            Icon ? "pr-9" : "pr-3",
            T.sel,
            error && "!border-rose-500",
            props.disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          {children}
        </select>
      </div>

      {error && (
        <p className="text-[9px] text-rose-500 font-black mt-0.5 flex items-center gap-1">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

// بطاقة اختيار نوع السند
function TypeSelector({ value, onChange }) {
  const iconMap = {
    aid: Heart,
    budget: Wallet,
    activities: Activity,
    trip: MapPin,
    event: Sparkles,
    advance: User,
    other: FileText,
    bank_charge: Landmark,
  };
  const subMap = {
    aid: "بدون تسوية",
    budget: "مرن حسب التحديد",
    activities: "مرن حسب التحديد",
    trip: "شيك + اشتراكات",
    event: "تتطلب تسوية",
    advance: "عهدة تُسوّى",
    other: "مرن حسب التحديد",
    bank_charge: "خصم مباشر من الحساب",
  };
  const types = [
    ...ISSUED_CHECK_TYPES,
    { id: "bank_charge", label: "خصم مباشر", color: "slate" },
  ].map((item) => ({
    ...item,
    icon: iconMap[item.id] || Landmark,
    sub: subMap[item.id] || "",
  }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
      {types.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={clsx(
              "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all font-black text-[11px]",
              active
                ? `border-${t.color}-500 bg-${t.color}-50 text-${t.color}-700 dark:bg-${t.color}-900/20 dark:text-${t.color}-400 shadow-sm`
                : `border-slate-200 dark:border-slate-700 text-slate-500 hover:border-${t.color}-300 hover:bg-${t.color}-50/30 dark:hover:bg-${t.color}-900/10`
            )}
          >
            <Icon size={18} className={active ? `text-${t.color}-600` : "text-slate-400"} />
            <span>{t.label}</span>
            <span className="text-[9px] font-bold opacity-70">{t.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────
export default function TreasuryForm({
  userRole,
  canPost = false,
  onSubmit,
  nextCheque,
  initialData,
  onCancel,
  showToast
}) {
  const T = useT();
  const isEdit = Boolean(initialData?.id);

  const location = useLocation();
  const urlParams = new URLSearchParams(location?.search || "");
  const requestedType = normalizeIssuedCheckType(urlParams.get("type") || "aid");
  const defaultType =
    requestedType === "bank_charge" || ISSUED_CHECK_TYPE_LABELS[requestedType]
      ? requestedType
      : "aid";

  const requiresChequeNumber = (type) => type !== "bank_charge";

  const getEmptyTx = useCallback(
    () => ({
      type: defaultType,
      date: getTodayISO(),
      amount: "",
      party: "",
      beneficiaryName: "",
      expenseItem: "",
      bankChargeCategory: "",
      bankReference: "",
      employeeId: "",
      notes: "",
      checkNum: requiresChequeNumber(defaultType) ? nextCheque || "" : "",
      aidCategory: "",
      aidRel: "",
      incidentDate: "",
      activityName: "",
      activityType: "",
      activityDate: "",
      participantsCount: "",
      activityLocation: "",
      memberSubscriptions: "",
      requires_settlement: getDefaultRequiresSettlement(defaultType),
      attachments: [],
      state: "posted",
    }),
    [defaultType, nextCheque]
  );

  const [tx, setTx] = useState(() =>
    isEdit
      ? {
          ...getEmptyTx(),
          ...initialData,
          type: normalizeIssuedCheckType(initialData?.type || defaultType),
          requires_settlement:
            initialData?.requires_settlement ??
            initialData?.requiresSettlement ??
            getDefaultRequiresSettlement(normalizeIssuedCheckType(initialData?.type || defaultType)),
        }
      : getEmptyTx()
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [employeesDB, setEmployeesDB] = useState([]);
  const [searchQ, setSearchQ] = useState(initialData?.party || initialData?.beneficiaryName || "");
  const [searchRes, setSearchRes] = useState([]);
  const [showRes, setShowRes] = useState(false);
  const [empData, setEmpData] = useState(null);
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(Boolean(isEdit));
  const currentRequiresSettlement = Boolean(tx.requires_settlement);
  const isAid = tx.type === "aid";
  const isAdvance = tx.type === "advance";
  const isTrip = tx.type === "trip";
  const isEvent = tx.type === "event";
  const isDirectCharge = tx.type === "bank_charge";
  const usesEmployeeLookup = EMPLOYEE_LOOKUP_TYPES.includes(tx.type);
  const usesEventDetails = EVENT_DETAILS_TYPES.includes(tx.type);
  const allowsOptionalSettlement = OPTIONAL_SETTLEMENT_TYPES.includes(tx.type);

  const suggestedAidAmount = useMemo(() => {
    if (!tx.aidCategory || !tx.aidRel) return "";
    return AID_AMOUNTS[`${tx.aidCategory}:${tx.aidRel}`] || 300;
  }, [tx.aidCategory, tx.aidRel]);

  const update = useCallback((key, value) => {
    setTx((prev) => ({ ...prev, [key]: value }));
    setErrors((prevErr) => {
      if (!prevErr[key]) return prevErr;
      const nextErr = { ...prevErr };
      delete nextErr[key];
      return nextErr;
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "employees")));
        setEmployeesDB(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("خطأ في جلب الأعضاء:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!searchQ || searchQ.length < 2 || !showRes) {
      setSearchRes([]);
      return;
    }

    const lq = searchQ.toLowerCase();

    setSearchRes(
      sortMembersByAgeThenJobId(
        employeesDB.filter(
          (e) =>
            e.name?.toLowerCase().includes(lq) ||
            e.jobId?.toString().includes(lq) ||
            e.nationalId?.includes(lq)
        )
      ).slice(0, 6)
    );
  }, [searchQ, showRes, employeesDB]);

  // اقتراح مبلغ الرعاية تلقائياً بدون منع التعديل اليدوي
  useEffect(() => {
    if (!isAid || isEdit) return;
    if (!tx.aidCategory || !tx.aidRel) return;
    if (amountManuallyEdited) return;

    update("amount", String(suggestedAidAmount));
  }, [
    isAid,
    tx.aidCategory,
    tx.aidRel,
    isEdit,
    amountManuallyEdited,
    suggestedAidAmount,
    update
  ]);

  // إعادة رقم الشيك عند تغيير النوع
  useEffect(() => {
    if (!isEdit && requiresChequeNumber(tx.type)) {
      update("checkNum", nextCheque || "");
    }
    if (!requiresChequeNumber(tx.type) && tx.checkNum) {
      update("checkNum", "");
    }
  }, [tx.type, nextCheque, isEdit, update]);

  const selectEmployee = (emp) => {
    update("party", emp.name);
    update("employeeId", emp.jobId || emp.id);
    setEmpData(emp);
    setSearchQ(emp.name);
    setShowRes(false);
  };

  const validate = () => {
    const e = {};

    if (!tx.date) e.date = "التاريخ مطلوب";

    if (!tx.amount || Number(tx.amount) <= 0) {
      e.amount = "أدخل مبلغاً موجباً";
    } else if (!/^\d+(\.\d{1,2})?$/.test(String(tx.amount))) {
      e.amount = "صيغة المبلغ غير صحيحة";
    }

    if (requiresChequeNumber(tx.type)) {
      if (!tx.checkNum) {
        e.checkNum = "رقم الشيك مطلوب";
      } else if (!/^\d+$/.test(String(tx.checkNum))) {
        e.checkNum = "رقم الشيك يجب أن يكون رقمياً فقط";
      }
    }

    if (usesEmployeeLookup && !tx.party?.trim()) {
      e.party = isAdvance ? "اسم مسؤول السلفة مطلوب" : "العضو أو المسؤول مطلوب";
    }

    if (!usesEmployeeLookup && !isDirectCharge && !tx.beneficiaryName?.trim()) {
      e.beneficiaryName = "اسم المستفيد مطلوب";
    }

    if (isDirectCharge && !tx.bankChargeCategory?.trim()) {
      e.bankChargeCategory = "اختر نوع الخصم المباشر";
    }

    if (isAid) {
      if (!tx.aidCategory) e.aidCategory = "اختر نوع الإعانة";
      if (!tx.aidRel) e.aidRel = "اختر صلة القرابة";
      if (tx.incidentDate && tx.date && tx.incidentDate > tx.date) {
        e.incidentDate = "تاريخ الواقعة لا يجوز أن يكون بعد تاريخ الحركة";
      }
      if (empData && !isEligibleForBenefit(empData, tx.date)) {
        const retirementDate = getRetirementDate(empData);
        e.party = retirementDate
          ? `هذا العضو غير مستحق للإعانة بعد تاريخ المعاش (${formatEmployeeDate(retirementDate)}).`
          : "هذا العضو غير مستحق للإعانة وفق حالة العضوية الحالية.";
      }
    }

    if (usesEventDetails) {
      if (!tx.activityName?.trim()) e.activityName = "اسم الفاعلية مطلوب";
      if (!tx.activityType) e.activityType = isTrip ? "حدد نوع الرحلة" : "حدد نوع الفاعلية";
      if (tx.participantsCount && Number(tx.participantsCount) < 0) {
        e.participantsCount = "عدد المشاركين غير صحيح";
      }
    }

    if (OPTIONAL_SETTLEMENT_TYPES.includes(tx.type) && !tx.expenseItem?.trim()) {
      e.expenseItem = "بند الصرف مطلوب";
    }

    if (isTrip) {
      if (!tx.memberSubscriptions || Number(tx.memberSubscriptions) < 0) {
        e.memberSubscriptions = "أدخل قيمة اشتراكات الأعضاء";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      showToast?.("برجاء استكمال الحقول المطلوبة", "error");
      return;
    }

    setSaving(true);
    try {
      const requiresSettlement = Boolean(tx.requires_settlement);
      const normalizedParty = usesEmployeeLookup ? tx.party : tx.beneficiaryName;
      const normalizedType = normalizeIssuedCheckType(tx.type);
      const finalParty = isDirectCharge
        ? tx.beneficiaryName?.trim() || tx.party?.trim() || "خصم بنكي مباشر"
        : normalizedParty;

      await onSubmit(
        {
          ...tx,
          type: normalizedType,
          party: finalParty,
          beneficiaryName: usesEmployeeLookup ? tx.beneficiaryName : finalParty,
          amount: String(tx.amount).trim(),
          checkNum: requiresChequeNumber(normalizedType) ? String(tx.checkNum).trim() : "",
          participantsCount: tx.participantsCount ? String(tx.participantsCount).trim() : "",
          memberSubscriptions: tx.memberSubscriptions ? String(tx.memberSubscriptions).trim() : "",
          requires_settlement: isDirectCharge ? false : requiresSettlement,
          requiresSettlement: isDirectCharge ? false : requiresSettlement,
          settlement_mode: isDirectCharge ? "none" : getSettlementMode(normalizedType, requiresSettlement),
          isSettled: isDirectCharge ? false : (requiresSettlement ? Boolean(tx.isSettled) : false),
          settlementExpenses: isDirectCharge ? [] : (requiresSettlement ? (tx.settlementExpenses || []) : []),
          advanceAmountBase: String(tx.amount).trim(),
          employeeName: finalParty,
      state: "posted",
        },
        isEdit
      );

      if (!isEdit) {
        const currentCheck = Number(tx.checkNum || nextCheque || 0);

        setTx({
          ...getEmptyTx(),
          type: normalizedType,
          checkNum: requiresChequeNumber(normalizedType) ? String(currentCheck + 1) : "",
          requires_settlement: getDefaultRequiresSettlement(normalizedType),
        });
        setSearchQ("");
        setEmpData(null);
        setAmountManuallyEdited(false);
        showToast?.("تم حفظ المستند بنجاح ✅");
      }
    } catch (err) {
      console.error("خطأ في الحفظ:", err);
      showToast?.("حدث خطأ أثناء الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  const color = ISSUED_CHECK_TYPE_COLORS[tx.type] || "teal";

  return (
    <div
      className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      dir="rtl"
    >
      {/* ── Header ثابت ── */}
      <div
        className={clsx(
          "fixed top-0 left-0 right-0 z-50",
          "border-b border-slate-200 dark:border-slate-700",
          "bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl shadow-sm"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={clsx("p-2.5 rounded-lg shrink-0", `bg-${color}-500/10`)}>
                <Landmark size={20} className={`text-${color}-600`} />
              </div>

              <div className="min-w-0">
                <h1 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {isDirectCharge
                    ? isEdit
                      ? "تعديل حركة مالية مباشرة"
                      : "إضافة حركة مالية مباشرة"
                    : isEdit
                      ? "تعديل إصدار شيك"
                      : "إصدار شيك جديد"}
                </h1>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {ISSUED_CHECK_TYPE_LABELS[tx.type] || tx.type}
                </p>
              </div>
            </div>

            <div className="hidden md:block">
              <WorkflowStepper state={tx.state} />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className={clsx(
                    "p-2 rounded-lg border hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 transition-all",
                    T.btn
                  )}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className={clsx("max-w-6xl mx-auto mt-20 pb-32 px-4 space-y-4", T.text)}>
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-teal-500 rounded-full"></div>
            <div>
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                نوع الحركة المالية
              </p>
              {isEdit && <p className="text-[10px] font-bold text-slate-400 mt-1">يمكنك تغيير نوع الحركة وسيتم تحديث الحقول التابعة لها تلقائيًا مع الإبقاء على البيانات المشتركة.</p>}
            </div>
          </div>

          <TypeSelector
            value={tx.type}
            onChange={(v) => {
              const normalizedType = normalizeIssuedCheckType(v);
              setAmountManuallyEdited(false);
              setSearchQ("");
              setEmpData(null);
              setTx((prev) => ({
                ...getEmptyTx(),
                id: prev.id,
                createdAt: prev.createdAt,
                updatedAt: prev.updatedAt,
                state: prev.state,
                attachments: prev.attachments || [],
                amount: prev.amount,
                date: prev.date,
                notes: prev.notes,
                checkNum: requiresChequeNumber(normalizedType) ? (prev.checkNum || nextCheque || "") : "",
                type: normalizedType,
                requires_settlement: normalizedType === "bank_charge" ? false : getDefaultRequiresSettlement(normalizedType),
                party: EMPLOYEE_LOOKUP_TYPES.includes(normalizedType) ? prev.party : "",
                employeeId: EMPLOYEE_LOOKUP_TYPES.includes(normalizedType) ? prev.employeeId : "",
                beneficiaryName: EMPLOYEE_LOOKUP_TYPES.includes(normalizedType) ? "" : (prev.beneficiaryName || prev.party || ""),
                expenseItem: OPTIONAL_SETTLEMENT_TYPES.includes(normalizedType) || normalizedType === "bank_charge" ? prev.expenseItem : "",
                bankChargeCategory: normalizedType === "bank_charge" ? prev.bankChargeCategory : "",
                bankReference: normalizedType === "bank_charge" ? prev.bankReference : "",
                activityName: EVENT_DETAILS_TYPES.includes(normalizedType) ? prev.activityName : "",
                activityType: EVENT_DETAILS_TYPES.includes(normalizedType) ? prev.activityType : "",
                activityDate: EVENT_DETAILS_TYPES.includes(normalizedType) ? prev.activityDate : "",
                activityLocation: EVENT_DETAILS_TYPES.includes(normalizedType) ? prev.activityLocation : "",
                participantsCount: EVENT_DETAILS_TYPES.includes(normalizedType) ? prev.participantsCount : "",
                memberSubscriptions: normalizedType === "trip" ? prev.memberSubscriptions : "",
                aidCategory: normalizedType === "aid" ? prev.aidCategory : "",
                aidRel: normalizedType === "aid" ? prev.aidRel : "",
                incidentDate: normalizedType === "aid" ? prev.incidentDate : "",
              }));
            }}
          />
        </div>

        {/* البيانات الأساسية */}
        <ERPSection
          title="بيانات السند الأساسية"
          icon={FileText}
          colorClass="slate"
          badge={tx.state === "posted" ? "مرحّل" : "مسودة"}
        >
          <div className="space-y-1">
            <ArabicDatePicker
              label="تاريخ الحركة"
              required
              value={tx.date}
              maxVal={getTodayISO()}
              onChange={(v) => update("date", v)}
            />
            {errors.date && (
              <p className="text-[9px] text-rose-500 font-black flex items-center gap-1">
                <AlertCircle size={10} />
                {errors.date}
              </p>
            )}
          </div>

          <ERPInput
            label={isDirectCharge ? "قيمة الخصم المباشر (ج.م)" : "المبلغ الإجمالي (ج.م)"}
            required
            value={tx.amount}
            onChange={(e) => {
              if (isAid) setAmountManuallyEdited(true);
              update("amount", normalizeNumericInput(e.target.value));
            }}
            isNumeric
            error={errors.amount}
            icon={DollarSign}
            placeholder="0.00"
            footer={
              tx.amount && !errors.amount ? (
                <p className="text-[9px] text-emerald-600 font-black pr-1">
                  {formatMoney(tx.amount)} ج.م
                </p>
              ) : null
            }
          />

          {requiresChequeNumber(tx.type) ? (
          <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase pr-1 flex justify-between">
                رقم الشيك البنكي
                <span className="text-[9px] text-amber-500 font-bold">
                  المقترح: #{nextCheque}
                </span>
              </label>

              <div className="relative group">
                <Hash
                  size={14}
                  className={clsx(
                    "absolute right-3 top-2.5 z-10 pointer-events-none",
                    errors.checkNum ? "text-rose-500" : "text-slate-400"
                  )}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={tx.checkNum}
                  onChange={(e) => update("checkNum", normalizeIntegerInput(e.target.value))}
                  className={clsx(
                    "w-full pr-9 pl-4 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 h-[38px]",
                    T.inp,
                    errors.checkNum && "!border-rose-500 bg-rose-50/10"
                  )}
                  placeholder={String(nextCheque || "")}
                />
              </div>

              {errors.checkNum && (
                <p className="text-[9px] text-rose-500 font-black flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.checkNum}
                </p>
              )}
          </div>
          ) : (
          <ERPInput
            label="مرجع العملية البنكية"
            value={tx.bankReference || ""}
            onChange={(e) => update("bankReference", e.target.value)}
            icon={Hash}
            placeholder="اختياري: رقم العملية أو مرجع البنك"
            fullWidth
          />
          )}
        </ERPSection>

        {allowsOptionalSettlement && (
          <ERPSection title="إعدادات التسوية" icon={Wallet} colorClass="emerald">
            <label className="sm:col-span-2 flex items-start gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 cursor-pointer hover:bg-emerald-100/70 transition-colors">
              <input
                type="checkbox"
                checked={currentRequiresSettlement}
                onChange={(e) => update("requires_settlement", e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-emerald-600"
              />
              <div>
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 block">هذا الشيك يتطلب تسوية لاحقة</span>
                <span className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-300/80">يمكن استخدامه مع الميزانيات والأنشطة والمصروفات الأخرى حسب قرارك الإداري.</span>
              </div>
            </label>
          </ERPSection>
        )}

        {!usesEmployeeLookup && !isDirectCharge && (
          <ERPSection title="بيانات المستفيد وبند الصرف" icon={Building} colorClass="slate">
            <ERPInput
              label="اسم المستفيد"
              required
              value={tx.beneficiaryName || ""}
              onChange={(e) => update("beneficiaryName", e.target.value)}
              icon={User}
              error={errors.beneficiaryName}
              placeholder="اسم الجهة أو المستفيد"
            />

            <div className="space-y-1">
              <DynamicSelect
                label="بند الصرف *"
                value={tx.expenseItem || ""}
                onChange={(v) => update("expenseItem", v)}
                icon={Tag}
                defaultOptions={EXPENSE_ITEM_OPTIONS}
              />
              {errors.expenseItem && (
                <p className="text-[9px] text-rose-500 font-black mt-1 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.expenseItem}
                </p>
              )}
            </div>
          </ERPSection>
        )}

        {isDirectCharge && (
          <ERPSection title="بيانات الخصم المباشر" icon={Landmark} colorClass="slate" badge="بدون شيك">
            <div className="space-y-1">
              <DynamicSelect
                label="نوع الخصم المباشر *"
                value={tx.bankChargeCategory || ""}
                onChange={(v) => update("bankChargeCategory", v)}
                icon={Tag}
                defaultOptions={DIRECT_BANK_CHARGE_OPTIONS}
              />
              {errors.bankChargeCategory && (
                <p className="text-[9px] text-rose-500 font-black mt-1 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.bankChargeCategory}
                </p>
              )}
            </div>

            <ERPInput
              label="الجهة أو البيان المختصر"
              value={tx.beneficiaryName || ""}
              onChange={(e) => update("beneficiaryName", e.target.value)}
              icon={Building}
              placeholder="مثال: البنك الأهلي - خصم كشف حساب"
            />

            <div className="sm:col-span-2 flex items-start gap-2 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/40">
              <Info size={14} className="text-slate-600 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                هذه الحركة تُخصم مباشرة من كشف الحساب البنكي ولا تحتاج إلى إصدار شيك أو تسوية لاحقة.
              </p>
            </div>
          </ERPSection>
        )}

        {/* بيانات العضو / المسؤول */}
        {usesEmployeeLookup && (
          <ERPSection
            title={usesEventDetails ? "مسؤول الشيك (الرحلة / الفاعلية)" : isAdvance ? "مسؤول السلفة / العهدة" : "العضو المستفيد"}
            icon={User}
            colorClass="teal"
          >
            <div className="sm:col-span-2 space-y-1 relative">
              <label className="text-[10px] font-black text-slate-500 uppercase pr-1">
                البحث في قاعدة الأعضاء *
              </label>

              <div className="relative group">
                <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  className={clsx(
                    "w-full pr-9 pl-10 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 h-[38px]",
                    T.inp,
                    errors.party && "!border-rose-500"
                  )}
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    update("party", e.target.value);
                    setShowRes(true);
                  }}
                  onFocus={() => setShowRes(true)}
                  onBlur={() => setTimeout(() => setShowRes(false), 200)}
                  placeholder="ابحث بالاسم أو الرقم الوظيفي أو القومي..."
                />

                {!!searchQ && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQ("");
                      update("party", "");
                      update("employeeId", "");
                      setEmpData(null);
                      setShowRes(false);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X size={12} className="text-slate-400" />
                  </button>
                )}

                {showRes && (
                  <div
                    className={clsx(
                      "absolute top-full mt-1 w-full border rounded-xl shadow-2xl overflow-hidden z-[120]",
                      T.card
                    )}
                  >
                    {searchRes.length > 0 ? (
                      searchRes.map((emp) => {
                        const retired = isRetiredMember(emp);
                        return (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={() => selectEmployee(emp)}
                          className={clsx("w-full p-2.5 flex items-center justify-between hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border-b last:border-0 text-right", retired && "bg-rose-50/60 dark:bg-rose-950/10")}
                        >
                          <div>
                            <p className={clsx("text-[11px] font-black", retired && "line-through text-rose-700 dark:text-rose-300")}>{emp.name}</p>
                            <p className="text-[9px] text-slate-400">
                              {retired ? `محال للمعاش${emp.retirementDate ? ` - ${emp.retirementDate}` : ""}` : (emp.position || emp.jobTitle)}
                            </p>
                          </div>

                          <span className="text-[9px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-lg">
                            {emp.jobId || "—"}
                          </span>
                        </button>
                      )})
                    ) : searchQ.length >= 2 ? (
                      <div className="p-3 text-[10px] font-bold text-slate-500">
                        لا توجد نتائج مطابقة
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {tx.employeeId && (
                <div className="flex items-center gap-1.5 text-teal-600 font-black text-[9px] mt-1 bg-teal-50 dark:bg-teal-900/30 w-fit px-2 py-0.5 rounded-lg">
                  <UserCheck size={10} />
                  مرتبط بالكود: {tx.employeeId}
                </div>
              )}

              {isAid && empData && !isEligibleForBenefit(empData, tx.date) && (
                <div className="mt-2 p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-black">
                  {getRetirementDate(empData)
                    ? `هذا العضو غير مستحق للإعانة بعد تاريخ المعاش (${formatEmployeeDate(getRetirementDate(empData))}).`
                    : "هذا العضو غير مستحق للإعانة أو المزايا وفق حالته الحالية."}
                </div>
              )}

              {errors.party && (
                <p className="text-[9px] text-rose-500 font-black flex items-center gap-1 mt-0.5">
                  <AlertCircle size={10} />
                  {errors.party}
                </p>
              )}
            </div>
          </ERPSection>
        )}

        {/* بيانات الإعانة */}
        {isAid && (
          <ERPSection title="موجبات صرف الإعانة" icon={Heart} colorClass="rose">
            <ERPSelect
              label="نوع الإعانة"
              required
              icon={Tag}
              value={tx.aidCategory}
              error={errors.aidCategory}
              onChange={(e) => {
                setAmountManuallyEdited(false);
                update("aidCategory", e.target.value);
                update("aidRel", "");
              }}
            >
              <option value="">-- اختر نوع الإعانة --</option>
              {Object.keys(AID_RELS).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </ERPSelect>

            <ERPSelect
              label="صلة القرابة"
              required
              icon={Users}
              value={tx.aidRel}
              error={errors.aidRel}
              onChange={(e) => {
                setAmountManuallyEdited(false);
                update("aidRel", e.target.value);
              }}
              disabled={!tx.aidCategory}
            >
              <option value="">-- اختر --</option>
              {(AID_RELS[tx.aidCategory] || []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </ERPSelect>

            <div className="sm:col-span-2 space-y-1">
              <ArabicDatePicker
                label="تاريخ واقعة الإعانة"
                value={tx.incidentDate}
                maxVal={tx.date}
                onChange={(v) => update("incidentDate", v)}
              />
              {errors.incidentDate && (
                <p className="text-[9px] text-rose-500 font-black flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.incidentDate}
                </p>
              )}
            </div>

            {tx.aidCategory && tx.aidRel && (
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-xl">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-rose-500 shrink-0" />
                  <p className="text-[10px] font-black text-rose-700 dark:text-rose-400">
                    المبلغ المقترح:
                    <span className="mr-1 text-rose-600 dark:text-rose-300">
                      {formatMoney(suggestedAidAmount)} ج.م
                    </span>
                  </p>

                  {amountManuallyEdited && (
                    <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg">
                      تم تعديل المبلغ يدوياً
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAmountManuallyEdited(false);
                    update("amount", String(suggestedAidAmount));
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition flex items-center gap-1"
                >
                  <RotateCcw size={11} />
                  استعادة المبلغ المقترح
                </button>
              </div>
            )}
          </ERPSection>
        )}

        {/* بيانات الرحلة / الفاعلية */}
        {usesEventDetails && (
          <ERPSection
            title={isTrip ? "تفاصيل الرحلة" : "تفاصيل الفاعلية"}
            icon={isTrip ? MapPin : Activity}
            colorClass={isTrip ? "indigo" : "amber"}
            badge={isTrip ? "شيك + اشتراكات" : "تتطلب تسوية"}
          >
            <ERPInput
              label={isTrip ? "اسم الرحلة" : "اسم الفاعلية / الحدث"}
              required
              fullWidth
              value={tx.activityName || ""}
              onChange={(e) => update("activityName", e.target.value)}
              error={errors.activityName}
              icon={Tag}
              placeholder={isTrip ? "مثال: رحلة شرم الشيخ الصيفية" : "مثال: إفطار جماعي لشهر رمضان"}
            />

            <ERPSelect
              label={isTrip ? "نوع الرحلة" : "نوع الفاعلية"}
              required
              icon={Tag}
              value={tx.activityType || ""}
              error={errors.activityType}
              onChange={(e) => update("activityType", e.target.value)}
            >
              <option value="">-- حدد النوع --</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </ERPSelect>

            <div className="space-y-1">
              <ArabicDatePicker
                label={isTrip ? "موعد الرحلة" : "موعد الفاعلية"}
                value={tx.activityDate || ""}
                minVal={getTodayISO()}
                onChange={(v) => update("activityDate", v)}
              />
            </div>

            <ERPInput
              label="عدد المشاركين المتوقع"
              value={tx.participantsCount || ""}
              onChange={(e) => update("participantsCount", normalizeIntegerInput(e.target.value))}
              isNumeric
              icon={Users}
              placeholder="عدد الأشخاص"
              error={errors.participantsCount}
            />

            {isTrip && (
              <ERPInput
                label="اشتراكات الأعضاء"
                required
                value={tx.memberSubscriptions || ""}
                onChange={(e) => update("memberSubscriptions", normalizeNumericInput(e.target.value))}
                isNumeric
                icon={DollarSign}
                placeholder="0.00"
                error={errors.memberSubscriptions}
              />
            )}

            <ERPInput
              label={isTrip ? "وجهة الرحلة" : "موقع الفاعلية"}
              fullWidth
              value={tx.activityLocation || ""}
              onChange={(e) => update("activityLocation", e.target.value)}
              icon={MapPin}
              placeholder={isTrip ? "مثال: شرم الشيخ" : "مثال: قاعة النقابة"}
            />

            <div className={clsx("sm:col-span-2 flex items-start gap-2 px-3 py-2 rounded-xl border", isTrip ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40")}>
              <Info size={14} className={clsx("mt-0.5 shrink-0", isTrip ? "text-indigo-600" : "text-amber-600")} />
              <p className={clsx("text-[10px] font-bold", isTrip ? "text-indigo-700 dark:text-indigo-400" : "text-amber-700 dark:text-amber-400")}>
                {isTrip
                  ? "ميزانية الرحلة في التسوية ستساوي قيمة الشيك مضافًا إليها اشتراكات الأعضاء المسجلة هنا."
                  : "الفاعلية تُسوى لاحقًا على أساس أن إجمالي تكلفة الفاعلية يساوي قيمة هذا الشيك."}
              </p>
            </div>
          </ERPSection>
        )}

        {/* الملاحظات والمرفقات */}
        <ERPSection title="البيان التوضيحي والمرفقات" icon={FileText} colorClass="indigo">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase pr-1">
              {isDirectCharge
                ? "تفاصيل الخصم المباشر"
                : usesEventDetails
                  ? "تفاصيل إضافية / بند الصرف"
                  : "ملاحظات وبيان الشيك"}
            </label>

            <textarea
              rows={3}
              className={clsx(
                "w-full px-3 py-2 rounded-xl border text-xs font-bold resize-none outline-none focus:ring-2",
                T.inp
              )}
              value={tx.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder={
                isDirectCharge
                  ? "اكتب شرحًا مختصرًا للعمولة أو المصروف البنكي المباشر..."
                  : usesEventDetails
                  ? "اكتب تفاصيل بنود الصرف والميزانية..."
                  : "اكتب التفاصيل والمستندات المرفقة..."
              }
            />
          </div>

          {currentRequiresSettlement && !isDirectCharge && (
            <div className="sm:col-span-2 flex items-start gap-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 px-3 py-2 rounded-xl">
              <Info size={14} className="text-teal-600 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400">
                سيتم إرسال هذا الشيك لاحقًا إلى شاشة التسويات ضمن مجموعة موحدة باسم <span className="font-black">issued_checks</span>.
              </p>
            </div>
          )}

          {isDirectCharge && (
            <div className="sm:col-span-2 flex items-start gap-2 bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/40 px-3 py-2 rounded-xl">
              <Info size={14} className="text-slate-600 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                سيتم حفظ هذه الحركة المباشرة داخل سجل <span className="font-black">transactions</span> لتظهر في كشف الحساب والداش بورد ضمن المصروفات البنكية والعمولات.
              </p>
            </div>
          )}

          <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <FileUpload
              existingFiles={tx.attachments || []}
              onChange={(files) => update("attachments", files)}
            />
          </div>
        </ERPSection>
      </div>

      {/* Footer ثابت */}
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-50",
          "border-t border-slate-200 dark:border-slate-700",
          "bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl shadow-sm"
        )}
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold text-slate-600 dark:text-slate-400">
              {tx.checkNum && requiresChequeNumber(tx.type) && (
                <span className="flex items-center gap-1">
                  <Hash size={12} />
                  شيك #{tx.checkNum}
                </span>
              )}
              {tx.amount && (
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {formatMoney(tx.amount)} ج.م
                </span>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className={clsx(
                  "flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs border transition-colors",
                  T.btn
                )}
              >
                إلغاء
              </button>

              {!isEdit && isAid && (
                <button
                  type="button"
                  onClick={() => {
                    if (validate()) {
                      printAidRequest?.({
                        emp: empData,
                        aidCat: tx.aidCategory,
                        aidRel: tx.aidRel,
                        incDate: tx.incidentDate,
                        amount: tx.amount,
                        date: tx.date,
                        notes: tx.notes
                      });
                    }
                  }}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg font-black text-[10px] flex items-center gap-1.5 border border-blue-300 dark:border-blue-700 transition-all"
                >
                  <Printer size={12} />
                  طلب
                </button>
              )}

              {!isEdit && !isDirectCharge && (
                <button
                  type="button"
                  onClick={() => {
                    if (validate()) {
                      printVoucher?.({
                        vType: `إصدار شيك - ${ISSUED_CHECK_TYPE_LABELS[tx.type] || tx.type}`,
                        vNum: tx.checkNum,
                        date: tx.date,
                        party: usesEmployeeLookup ? tx.party : tx.beneficiaryName,
                        amount: tx.amount,
                        notes: tx.notes,
                        checkNum: tx.checkNum,
                        extraFields:
                          [
                            { label: "نوع الشيك", value: ISSUED_CHECK_TYPE_LABELS[tx.type] || tx.type },
                            ...(usesEventDetails
                              ? [
                                  { label: isTrip ? "اسم الرحلة" : "اسم الفاعلية", value: tx.activityName },
                                  { label: isTrip ? "نوع الرحلة" : "نوع الفاعلية", value: tx.activityType },
                                  { label: isTrip ? "الوجهة" : "الموقع", value: tx.activityLocation },
                                ]
                              : []),
                            ...(OPTIONAL_SETTLEMENT_TYPES.includes(tx.type)
                              ? [{ label: "بند الصرف", value: tx.expenseItem }]
                              : []),
                            ...(currentRequiresSettlement
                              ? [{ label: "التسوية", value: "يتطلب تسوية" }]
                              : [{ label: "التسوية", value: "لا يتطلب تسوية" }]),
                          ]
                      });
                    }
                  }}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-black text-[10px] flex items-center gap-1.5 border transition-all"
                >
                  <Printer size={12} />
                  سند
                </button>
              )}

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className={clsx(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg font-black text-xs transition-all",
                  `bg-${color}-600 hover:bg-${color}-700 text-white disabled:opacity-50`
                )}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isEdit ? "تحديث" : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
