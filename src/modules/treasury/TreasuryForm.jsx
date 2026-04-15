/**
 * TreasuryForm — نموذج إصدار المستندات المالية
 * - إصلاح مشكلة ظهور التقويم خلف التابات/الهيدر عبر ArabicDatePicker باستخدام Portal
 * - السماح بتعديل المبلغ بعد اقتراحه في الرعاية
 * - إضافة زر استعادة المبلغ المقترح
 * - تحسين التحقق من الأرقام والتجربة البصرية
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { nextWorkflowState } from "./helpers/workflow";
import WorkflowStepper from "./WorkflowStepper";
import { printVoucher, printAidRequest } from "./VoucherPrint";
import FileUpload from "./FileUpload";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import DynamicSelect from "../../ui/inputs/DynamicSelect";

import {
  Search, Loader2, CheckCircle2, Printer, Landmark,
  FileText, User, Heart, Building, AlertCircle, Hash,
  DollarSign, UserCheck, Users, MapPin, Tag,
  Activity, X, Info, RotateCcw
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
const DEP_OPTS = ["النقابة العامة بالدقهلية", "أمين الصندوق", "اشتراكات أعضاء", "جهة خارجية"];
const BANK_OPTS = ["البنك الأهلي المصري", "بنك مصر", "البنك التجاري الدولي", "البنك العربي الأفريقي", "بنك آخر"];
const BANK_CHARGE_CATEGORIES = ["رسوم كشف حساب", "رسوم بريدية", "دفتر شيكات", "عمولات بنكية", "مصاريف بنكية أخرى"];

const AID_RELS = {
  "رعاية زواج": ["العضو نفسه", "ابن", "ابنة"],
  "رعاية وفاة": ["العضو نفسه", "الزوج", "الزوجة", "أب", "أم", "ابن", "ابنة"],
  "ظروف قهرية / صحية": ["العضو نفسه"],
  "مناسبات": ["ميزانيات", "دور وطني", "جوائز مسابقات", "مبادرات"],
};

const TYPE_LABELS = {
  deposit: "سند إيداع (دائن)",
  aid: "سند صرف رعاية (مدين)",
  advance: "سند سلفة / عهدة (مدين)",
  activity: "شيك دعم فاعلية (مدين)",
  bank_charge: "خصم بنكي مباشر (مدين)",
};

const TYPE_COLORS = {
  deposit: "emerald",
  aid: "rose",
  advance: "purple",
  activity: "amber",
  bank_charge: "slate",
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
  const bankChargeType = { id: "bank_charge", label: "خصم بنكي", sub: "بدون شيك", icon: Landmark, color: "slate" };
  const types = [
    { id: "deposit", label: "إيداع", sub: "سند دائن", icon: DollarSign, color: "emerald" },
    { id: "aid", label: "رعاية", sub: "سند مدين", icon: Heart, color: "rose" },
    { id: "advance", label: "سلفة", sub: "عهدة مدين", icon: User, color: "purple" },
    { id: "activity", label: "نشاط", sub: "شيك فاعلية", icon: Activity, color: "amber" },
  ];
  types.push(bankChargeType);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
  onSubmit,
  nextCheque,
  initialData,
  onCancel,
  showToast
}) {
  const T = useT();
  const isTreasurer = userRole === "treasurer";
  const isEdit = Boolean(initialData?.id);

  const location = useLocation();
  const urlParams = new URLSearchParams(location?.search || "");
  const defaultType = urlParams.get("type") || "deposit";

  const getEmptyTx = useCallback(
    () => ({
      type: defaultType,
      date: getTodayISO(),
      amount: "",
      party: "",
      employeeId: "",
      notes: "",
      checkNum: !["deposit", "bank_charge"].includes(defaultType) ? (nextCheque || "") : "",
      aidCategory: "",
      aidRel: "",
      incidentDate: "",
      activityName: "",
      activityType: "",
      activityDate: "",
      participantsCount: "",
      activityLocation: "",
      bankChargeCategory: "",
      bankReference: "",
      attachments: [],
      state: isTreasurer ? "posted" : "draft",
    }),
    [defaultType, nextCheque, isTreasurer]
  );

  const [tx, setTx] = useState(() => (isEdit ? { ...initialData } : getEmptyTx()));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [employeesDB, setEmployeesDB] = useState([]);
  const [searchQ, setSearchQ] = useState(initialData?.party || "");
  const [searchRes, setSearchRes] = useState([]);
  const [showRes, setShowRes] = useState(false);
  const [empData, setEmpData] = useState(null);
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(Boolean(isEdit));

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
    if (tx.type !== "aid" || isEdit) return;
    if (!tx.aidCategory || !tx.aidRel) return;
    if (amountManuallyEdited) return;

    update("amount", String(suggestedAidAmount));
  }, [
    tx.type,
    tx.aidCategory,
    tx.aidRel,
    isEdit,
    amountManuallyEdited,
    suggestedAidAmount,
    update
  ]);

  // إعادة رقم الشيك عند تغيير النوع
  useEffect(() => {
    if (!isEdit) {
      update("checkNum", !["deposit", "bank_charge"].includes(tx.type) ? (nextCheque || "") : "");
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

    if (!tx.party?.trim()) e.party = "الجهة أو العضو مطلوب";

    if (!["deposit", "bank_charge"].includes(tx.type)) {
      if (!tx.checkNum) {
        e.checkNum = "رقم الشيك مطلوب";
      } else if (!/^\d+$/.test(String(tx.checkNum))) {
        e.checkNum = "رقم الشيك يجب أن يكون رقمياً فقط";
      }
    }

    if (tx.type === "aid") {
      if (!tx.aidCategory) e.aidCategory = "اختر نوع الرعاية";
      if (!tx.aidRel) e.aidRel = "اختر صلة القرابة";
      if (tx.incidentDate && tx.date && tx.incidentDate > tx.date) {
        e.incidentDate = "تاريخ الواقعة لا يجوز أن يكون بعد تاريخ الحركة";
      }
      if (empData && !isEligibleForBenefit(empData, tx.date)) {
        const retirementDate = getRetirementDate(empData);
        e.party = retirementDate
          ? `هذا العضو غير مستحق للرعاية بعد تاريخ المعاش (${formatEmployeeDate(retirementDate)}).`
          : "هذا العضو غير مستحق للرعاية وفق حالة العضوية الحالية.";
      }
    }

    if (tx.type === "activity") {
      if (!tx.activityName?.trim()) e.activityName = "اسم الفاعلية مطلوب";
      if (!tx.activityType) e.activityType = "حدد نوع الفاعلية";
      if (tx.participantsCount && Number(tx.participantsCount) < 0) {
        e.participantsCount = "عدد المشاركين غير صحيح";
      }
    }

    if (tx.type === "bank_charge") {
      if (!tx.bankChargeCategory) e.bankChargeCategory = "حدد نوع الخصم البنكي";
      if (!tx.party?.trim()) e.party = "اسم البنك أو الحساب مطلوب";
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
      await onSubmit(
        {
          ...tx,
          amount: String(tx.amount).trim(),
          checkNum: !["deposit", "bank_charge"].includes(tx.type) ? String(tx.checkNum).trim() : "",
          participantsCount: tx.participantsCount ? String(tx.participantsCount).trim() : "",
        },
        isEdit
      );

      if (!isEdit) {
        const currentCheck = Number(tx.checkNum || nextCheque || 0);

        setTx({
          ...getEmptyTx(),
          checkNum: !["deposit", "bank_charge"].includes(tx.type) ? String(currentCheck + 1) : "",
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

  const color = TYPE_COLORS[tx.type] || "teal";

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
                  {isEdit ? "تعديل مستند مالي" : "إصدار مستند مالي جديد"}
                </h1>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {TYPE_LABELS[tx.type]}
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
        {!isEdit && (
          <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-teal-500 rounded-full"></div>
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                نوع المستند المالي
              </p>
            </div>

            <TypeSelector
              value={tx.type}
              onChange={(v) => {
                setAmountManuallyEdited(false);
                setTx((prev) => ({ ...getEmptyTx(), type: v, date: prev.date }));
              }}
            />
          </div>
        )}

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
            label="المبلغ الإجمالي (ج.م)"
            required
            value={tx.amount}
            onChange={(e) => {
              if (tx.type === "aid") setAmountManuallyEdited(true);
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

          {!["deposit", "bank_charge"].includes(tx.type) && (
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
          )}
        </ERPSection>

        {/* بيانات الإيداع */}
        {tx.type === "deposit" && (
          <ERPSection title="جهة الإيداع والمصدر" icon={Building} colorClass="emerald">
            <div className="sm:col-span-2">
              <DynamicSelect
                label="جهة الإيداع *"
                value={tx.party}
                onChange={(v) => update("party", v)}
                icon={Building}
                defaultOptions={DEP_OPTS}
              />
              {errors.party && (
                <p className="text-[9px] text-rose-500 font-black mt-1 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.party}
                </p>
              )}
            </div>
          </ERPSection>
        )}

        {tx.type === "bank_charge" && (
          <ERPSection title="بيانات الخصم البنكي المباشر" icon={Landmark} colorClass="slate">
            <div className="sm:col-span-2">
              <DynamicSelect
                label="البنك / الحساب *"
                value={tx.party}
                onChange={(v) => update("party", v)}
                icon={Landmark}
                defaultOptions={BANK_OPTS}
              />
              {errors.party && (
                <p className="text-[9px] text-rose-500 font-black mt-1 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.party}
                </p>
              )}
            </div>

            <ERPSelect
              label="نوع الخصم البنكي"
              required
              icon={Tag}
              value={tx.bankChargeCategory || ""}
              error={errors.bankChargeCategory}
              onChange={(e) => update("bankChargeCategory", e.target.value)}
            >
              <option value="">-- اختر نوع الخصم --</option>
              {BANK_CHARGE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </ERPSelect>

            <ERPInput
              label="المرجع البنكي"
              value={tx.bankReference || ""}
              onChange={(e) => update("bankReference", e.target.value)}
              icon={Hash}
              placeholder="رقم مرجع الخصم من كشف الحساب"
            />

            <div className="sm:col-span-2 flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <Info size={14} className="text-slate-600 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                يُستخدم هذا النوع للحركات التي يخصمها البنك مباشرة مثل رسوم كشف الحساب أو العمولات البنكية، لذلك لا يحتاج إلى رقم شيك أو سند صرف نقدي.
              </p>
            </div>
          </ERPSection>
        )}

        {/* بيانات العضو */}
        {["advance", "aid", "activity"].includes(tx.type) && (
          <ERPSection
            title={tx.type === "activity" ? "مسؤول الفاعلية (الرحلة/الإفطار)" : "العضو المستفيد / مسؤول العهدة"}
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

              {tx.type === "aid" && empData && !isEligibleForBenefit(empData, tx.date) && (
                <div className="mt-2 p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-black">
                  {getRetirementDate(empData)
                    ? `هذا العضو غير مستحق للرعاية بعد تاريخ المعاش (${formatEmployeeDate(getRetirementDate(empData))}).`
                    : "هذا العضو غير مستحق للرعاية أو المزايا وفق حالته الحالية."}
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

        {/* بيانات الرعاية */}
        {tx.type === "aid" && (
          <ERPSection title="موجبات صرف الرعاية" icon={Heart} colorClass="rose">
            <ERPSelect
              label="نوع الرعاية"
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
              <option value="">-- اختر نوع الرعاية --</option>
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
                label="تاريخ واقعة الرعاية"
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

        {/* بيانات الفاعلية */}
        {tx.type === "activity" && (
          <ERPSection
            title="تفاصيل الفاعلية — شيك دعم النشاط"
            icon={Activity}
            colorClass="amber"
            badge="جديد"
          >
            <ERPInput
              label="اسم الفاعلية / الحدث"
              required
              fullWidth
              value={tx.activityName || ""}
              onChange={(e) => update("activityName", e.target.value)}
              error={errors.activityName}
              icon={Tag}
              placeholder="مثال: رحلة شرم الشيخ الصيفية"
            />

            <ERPSelect
              label="نوع الفاعلية"
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
                label="موعد الفاعلية المقرر"
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

            <ERPInput
              label="موقع / وجهة الفاعلية"
              fullWidth
              value={tx.activityLocation || ""}
              onChange={(e) => update("activityLocation", e.target.value)}
              icon={MapPin}
              placeholder="مثال: شرم الشيخ / قاعة النقابة"
            />

            <div className="sm:col-span-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 rounded-xl">
              <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                يُمثل هذا المستند شيك دعم فاعلية ويُخصم من رصيد الخزينة. تأكد من اعتماد رئيس
                المجلس قبل الصرف.
              </p>
            </div>
          </ERPSection>
        )}

        {/* الملاحظات والمرفقات */}
        <ERPSection title="البيان التوضيحي والمرفقات" icon={FileText} colorClass="indigo">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase pr-1">
              {tx.type === "activity" ? "تفاصيل إضافية / بند الصرف" : "ملاحظات وبيان السند"}
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
                tx.type === "activity"
                  ? "اكتب تفاصيل بنود الصرف والميزانية..."
                  : "اكتب التفاصيل والمستندات المرفقة..."
              }
            />
          </div>

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
              {tx.checkNum && !["deposit", "bank_charge"].includes(tx.type) && (
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

              {!isEdit && tx.type === "aid" && (
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

              {!isEdit && !["deposit", "bank_charge"].includes(tx.type) && (
                <button
                  type="button"
                  onClick={() => {
                    if (validate()) {
                      printVoucher?.({
                        vType: TYPE_LABELS[tx.type],
                        vNum: tx.checkNum,
                        date: tx.date,
                        party: tx.party,
                        amount: tx.amount,
                        notes: tx.notes,
                        checkNum: tx.checkNum,
                        extraFields:
                          tx.type === "activity"
                            ? [
                                { label: "اسم الفاعلية", value: tx.activityName },
                                { label: "نوع الفاعلية", value: tx.activityType },
                                { label: "الموقع", value: tx.activityLocation }
                              ]
                            : []
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
