/**
 * TreasuryForm — نموذج إصدار المستندات المالية
 * ✅ إضافة: صرف شيك نشاط (activity) مع حقول متخصصة
 * ✅ إصلاح: التحقق من الأخطاء وعدم ظهور صفحات بيضاء
 * ✅ تحسين: توافق موبايل كامل
 * ✅ تحسين: تصميم احترافي
 */

import React, { useState, useEffect, useCallback } from "react";
import { nextWorkflowState } from "./helpers/workflow";
import WorkflowStepper from "./WorkflowStepper";
import { printVoucher, printAidRequest } from "./VoucherPrint";
import FileUpload from "./FileUpload";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import DynamicSelect from "../../ui/inputs/DynamicSelect";

import {
  Search, Loader2, CheckCircle2, Printer, Landmark,
  FileText, User, Heart, Building, AlertCircle, Hash,
  DollarSign, UserCheck, Calendar, Users, MapPin, Tag,
  Activity, X, ChevronDown, Info
} from "lucide-react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useLocation } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import clsx from "clsx";

// ─────────────────────────────────────────────
// ثوابت
// ─────────────────────────────────────────────
const DEP_OPTS = ["النقابة العامة بالدقهلية", "أمين الصندوق", "اشتراكات أعضاء", "جهة خارجية"];

const AID_RELS = {
  "إعانة زواج":           ["العضو نفسه", "ابن", "ابنة"],
  "إعانة وفاة":           ["العضو نفسه", "الزوج", "الزوجة", "أب", "أم", "ابن", "ابنة"],
  "ظروف قهرية / صحية":  ["العضو نفسه"],
};

const TYPE_LABELS = {
  deposit:  "سند إيداع (دائن)",
  aid:      "سند صرف إعانة (مدين)",
  advance:  "سند سلفة / عهدة (مدين)",
  activity: "شيك دعم فاعلية (مدين)",
};

const TYPE_COLORS = {
  deposit:  "emerald",
  aid:      "rose",
  advance:  "purple",
  activity: "amber",
};

const AID_AMOUNTS = {
  "إعانة وفاة:العضو نفسه": 500, "إعانة وفاة:الزوج": 500, "إعانة وفاة:الزوجة": 500,
  "إعانة وفاة:أب": 300, "إعانة وفاة:أم": 300, "إعانة وفاة:ابن": 300, "إعانة وفاة:ابنة": 300,
  "إعانة زواج:العضو نفسه": 500, "إعانة زواج:ابن": 300, "إعانة زواج:ابنة": 300,
  "ظروف قهرية / صحية:العضو نفسه": 300,
};

const ACTIVITY_TYPES = [
  "رحلة ترفيهية", "رحلة دينية", "إفطار جماعي", "حفل تكريم",
  "مسابقة رياضية", "مسابقة ثقافية", "احتفالية سنوية", "ندوة / محاضرة", "أخرى"
];

const getTodayISO = () => new Date().toISOString().split("T")[0];

// ─────────────────────────────────────────────
// مكونات مساعدة
// ─────────────────────────────────────────────
function ERPSection({ title, icon: Icon, colorClass = "teal", children, zIndex = "z-10", badge }) {
  const T = useT();
  return (
    <div className={clsx(
      `p-4 rounded-2xl border shadow-sm space-y-3 animate-in fade-in duration-500 relative ${zIndex}`,
      T.card
    )}>
      <div className="flex items-center justify-between border-b pb-2.5 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className={clsx("p-1.5 rounded-lg", `bg-${colorClass}-500/10`)}>
            <Icon size={14} className={`text-${colorClass}-600`} />
          </div>
          <h3 className={clsx("font-black text-[11px] uppercase tracking-widest", T.text)}>{title}</h3>
        </div>
        {badge && (
          <span className={clsx(
            "text-[9px] font-black px-2 py-0.5 rounded-full border",
            `bg-${colorClass}-50 text-${colorClass}-700 border-${colorClass}-200`,
            "dark:bg-opacity-20 dark:text-opacity-90"
          )}>{badge}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function ERPInput({ label, icon: Icon, error, isNumeric, hint, required, fullWidth, ...props }) {
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
          <Icon size={14} className={clsx(
            "absolute right-3 top-2.5 z-10 transition-colors pointer-events-none",
            error ? "text-rose-500" : "text-slate-400 group-focus-within:text-teal-500"
          )}/>
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
      {error && (
        <p className="text-[9px] text-rose-500 font-black mt-0.5 flex items-center gap-1">
          <AlertCircle size={10}/> {error}
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
        {Icon && <Icon size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none z-10"/>}
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
          <AlertCircle size={10}/> {error}
        </p>
      )}
    </div>
  );
}

// بطاقة اختيار نوع السند
function TypeSelector({ value, onChange }) {
  const T = useT();
  const types = [
    { id: "deposit",  label: "إيداع",    sub: "سند دائن",    icon: DollarSign, color: "emerald" },
    { id: "aid",      label: "إعانة",    sub: "سند مدين",    icon: Heart,      color: "rose"    },
    { id: "advance",  label: "سلفة",     sub: "عهدة مدين",   icon: User,       color: "purple"  },
    { id: "activity", label: "نشاط",     sub: "شيك فاعلية",  icon: Activity,   color: "amber"   },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {types.map(t => {
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
            <Icon size={18} className={active ? `text-${t.color}-600` : "text-slate-400"}/>
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
export default function TreasuryForm({ userRole, onSubmit, nextCheque, initialData, onCancel, showToast }) {
  const T = useT();
  const isTreasurer = userRole === "treasurer";
  const isEdit = Boolean(initialData?.id);

  // قراءة نوع السند من URL إن وُجد
  const location = useLocation();
  const urlParams = new URLSearchParams(location?.search || "");
  const defaultType = urlParams.get("type") || "deposit";

  const getEmptyTx = useCallback(() => ({
    type:           defaultType,
    date:           getTodayISO(),
    amount:         "",
    party:          "",
    employeeId:     "",
    notes:          "",
    checkNum:       defaultType !== "deposit" ? (nextCheque || "") : "",
    aidCategory:    "",
    aidRel:         "",
    incidentDate:   "",
    // حقول النشاط الجديدة
    activityName:   "",
    activityType:   "",
    activityDate:   "",
    participantsCount: "",
    activityLocation:  "",
    attachments:    [],
    state:          isTreasurer ? "posted" : "draft",
  }), [defaultType, nextCheque, isTreasurer]);

  const [tx, setTx]             = useState(() => isEdit ? { ...initialData } : getEmptyTx());
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [employeesDB, setEmployeesDB] = useState([]);
  const [searchQ, setSearchQ]   = useState(initialData?.party || "");
  const [searchRes, setSearchRes] = useState([]);
  const [showRes, setShowRes]   = useState(false);

  // تحديث الحقل
  const update = useCallback((key, value) => {
    setTx(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, [errors]);

  // جلب الأعضاء
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "employees")));
        setEmployeesDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("خطأ في جلب الأعضاء:", err);
      }
    })();
  }, []);

  // بحث الأعضاء
  useEffect(() => {
    if (!searchQ || searchQ.length < 2 || !showRes) { setSearchRes([]); return; }
    const lq = searchQ.toLowerCase();
    setSearchRes(
      employeesDB
        .filter(e => e.name?.toLowerCase().includes(lq) || e.jobId?.toString().includes(lq) || e.nationalId?.includes(lq))
        .slice(0, 6)
    );
  }, [searchQ, showRes, employeesDB]);

  // تعيين مبلغ الإعانة تلقائياً
  useEffect(() => {
    if (tx.type !== "aid" || isEdit) return;
    if (!tx.aidCategory || !tx.aidRel) return;
    const key = `${tx.aidCategory}:${tx.aidRel}`;
    update("amount", AID_AMOUNTS[key] || 300);
  }, [tx.aidCategory, tx.aidRel, tx.type, isEdit]);

  // إعادة تعيين رقم الشيك عند تغيير النوع
  useEffect(() => {
    if (!isEdit) {
      update("checkNum", tx.type !== "deposit" ? (nextCheque || "") : "");
    }
  }, [tx.type]);

  const selectEmployee = (emp) => {
    update("party", emp.name);
    update("employeeId", emp.jobId || emp.id);
    setSearchQ(emp.name);
    setShowRes(false);
  };

  // التحقق
  const validate = () => {
    const e = {};
    if (!tx.date)                                e.date       = "التاريخ مطلوب";
    if (!tx.amount || Number(tx.amount) <= 0)    e.amount     = "أدخل مبلغاً موجباً";
    if (!tx.party?.trim())                       e.party      = "الجهة أو العضو مطلوب";
    if (tx.type !== "deposit" && !tx.checkNum)   e.checkNum   = "رقم الشيك مطلوب";
    if (tx.type === "aid") {
      if (!tx.aidCategory)  e.aidCategory = "اختر نوع الإعانة";
      if (!tx.aidRel)       e.aidRel      = "اختر صلة القرابة";
    }
    if (tx.type === "activity") {
      if (!tx.activityName?.trim()) e.activityName = "اسم الفاعلية مطلوب";
      if (!tx.activityType)         e.activityType = "حدد نوع الفاعلية";
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
      await onSubmit(tx, isEdit);
      if (!isEdit) {
        setTx({
          ...getEmptyTx(),
          checkNum: tx.type !== "deposit" ? String(Number(tx.checkNum) + 1) : "",
        });
        setSearchQ("");
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

  // ─── Render ───────────────────────────────
  return (
    <div className={clsx("flex flex-col gap-4 max-w-4xl mx-auto pb-24 animate-in slide-in-from-bottom-8 duration-500", T.text)} dir="rtl">

      {/* ── رأس النموذج ── */}
      <div className={clsx(
        "p-3 px-5 rounded-2xl border shadow-md flex flex-wrap items-center justify-between gap-3",
        "sticky top-2 z-[100] backdrop-blur-md bg-white/90 dark:bg-slate-900/90",
        T.card
      )}>
        <div className="flex items-center gap-3">
          <div className={clsx("p-2.5 rounded-xl", `bg-${color}-500/10`)}>
            <Landmark size={18} className={`text-${color}-600`}/>
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight">
              {isEdit ? "تعديل مستند مالي" : "إصدار مستند مالي جديد"}
            </h2>
            <p className="text-[10px] font-bold text-slate-400">{TYPE_LABELS[tx.type]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <WorkflowStepper state={tx.state}/>
          </div>
          {onCancel && (
            <button type="button" onClick={onCancel}
              className={clsx("p-2 rounded-xl border hover:bg-rose-50 hover:text-rose-500 transition-all", T.btn)}>
              <X size={16}/>
            </button>
          )}
        </div>
      </div>

      {/* ── 1. اختيار نوع السند (تغيير نوع الحركة) ── */}
      {!isEdit && (
        <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
          <p className="text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
            <Tag size={12} className="text-teal-500"/> نوع المستند المالي
          </p>
          <TypeSelector value={tx.type} onChange={v => setTx(prev => ({ ...getEmptyTx(), type: v, date: prev.date }))}/>
        </div>
      )}

      {/* ── 2. البيانات الأساسية للسند ── */}
      <ERPSection title="بيانات السند الأساسية" icon={FileText} colorClass="slate" zIndex="z-[90]"
        badge={tx.state === "posted" ? "مرحّل" : "مسودة"}>
        <div className="space-y-1">
          <ArabicDatePicker label="تاريخ الحركة *" value={tx.date} maxVal={getTodayISO()} onChange={v => update("date", v)} />
          {errors.date && <p className="text-[9px] text-rose-500 font-black flex items-center gap-1"><AlertCircle size={10}/>{errors.date}</p>}
        </div>

        <ERPInput
          label="المبلغ الإجمالي (ج.م)" required
          value={tx.amount}
          onChange={e => update("amount", e.target.value)}
          isNumeric error={errors.amount} icon={DollarSign} placeholder="0.00"
        />

        {tx.type !== "deposit" && (
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase pr-1 flex justify-between">
              رقم الشيك البنكي <span className="text-[9px] text-amber-500 font-bold">المقترح: #{nextCheque}</span>
            </label>
            <div className="relative group">
              <Hash size={14} className={clsx("absolute right-3 top-2.5 z-10 pointer-events-none", errors.checkNum ? "text-rose-500" : "text-slate-400")}/>
              <input
                type="text" inputMode="numeric" value={tx.checkNum}
                onChange={e => update("checkNum", e.target.value)}
                className={clsx("w-full pr-9 pl-4 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 h-[38px]", T.inp, errors.checkNum && "!border-rose-500 bg-rose-50/10")}
                placeholder={String(nextCheque || "")}
              />
            </div>
            {errors.checkNum && <p className="text-[9px] text-rose-500 font-black flex items-center gap-1"><AlertCircle size={10}/>{errors.checkNum}</p>}
          </div>
        )}
      </ERPSection>

      {/* ── 3. بيانات الإيداع ── */}
      {tx.type === "deposit" && (
        <ERPSection title="جهة الإيداع والمصدر" icon={Building} colorClass="emerald" zIndex="z-[85]">
          <div className="sm:col-span-2">
            <DynamicSelect
              label="جهة الإيداع *"
              value={tx.party}
              onChange={v => update("party", v)}
              icon={Building}
              defaultOptions={DEP_OPTS}
            />
            {errors.party && <p className="text-[9px] text-rose-500 font-black mt-1 flex items-center gap-1"><AlertCircle size={10}/>{errors.party}</p>}
          </div>
        </ERPSection>
      )}

      {/* ── 4. العضو المستفيد (للإعانة والسلفة والنشاط) ── */}
      {["advance", "aid", "activity"].includes(tx.type) && (
        <ERPSection
          title={tx.type === "activity" ? "مسؤول الفاعلية (الرحلة/الإفطار)" : "العضو المستفيد / مسؤول العهدة"}
          icon={User} colorClass="teal" zIndex="z-[80]"
        >
          <div className="sm:col-span-2 space-y-1 relative">
            <label className="text-[10px] font-black text-slate-500 uppercase pr-1">
              البحث في قاعدة الأعضاء *
            </label>
            <div className="relative group">
              <Search size={14} className="absolute right-3 top-2.5 text-slate-400"/>
              <input
                type="text"
                className={clsx("w-full pr-9 pl-4 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 h-[38px]", T.inp, errors.party && "!border-rose-500")}
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); update("party", e.target.value); setShowRes(true); }}
                onFocus={() => setShowRes(true)}
                onBlur={() => setTimeout(() => setShowRes(false), 200)}
                placeholder="ابحث بالاسم أو الرقم الوظيفي أو القومي..."
              />
              {showRes && searchRes.length > 0 && (
                <div className={clsx("absolute top-full mt-1 w-full border rounded-xl shadow-2xl overflow-hidden z-[200]", T.card)}>
                  {searchRes.map(emp => (
                    <button key={emp.id} type="button" onMouseDown={() => selectEmployee(emp)}
                      className="w-full p-2.5 flex items-center justify-between hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border-b last:border-0 text-right">
                      <div>
                        <p className="text-[11px] font-black">{emp.name}</p>
                        <p className="text-[9px] text-slate-400">{emp.position || emp.jobTitle}</p>
                      </div>
                      <span className="text-[9px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-lg">{emp.jobId || "—"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tx.employeeId && (
              <div className="flex items-center gap-1.5 text-teal-600 font-black text-[9px] mt-1 bg-teal-50 dark:bg-teal-900/30 w-fit px-2 py-0.5 rounded-lg">
                <UserCheck size={10}/> مرتبط بالكود: {tx.employeeId}
              </div>
            )}
            {errors.party && <p className="text-[9px] text-rose-500 font-black flex items-center gap-1 mt-0.5"><AlertCircle size={10}/>{errors.party}</p>}
          </div>
        </ERPSection>
      )}

      {/* ── 5. بيانات الإعانة ── */}
      {tx.type === "aid" && (
        <ERPSection title="موجبات صرف الإعانة" icon={Heart} colorClass="rose" zIndex="z-[75]">
          <ERPSelect
            label="نوع الإعانة" required icon={Tag}
            value={tx.aidCategory} error={errors.aidCategory}
            onChange={e => { update("aidCategory", e.target.value); update("aidRel", ""); }}
          >
            <option value="">-- اختر نوع الإعانة --</option>
            {Object.keys(AID_RELS).map(c => <option key={c} value={c}>{c}</option>)}
          </ERPSelect>

          <ERPSelect
            label="صلة القرابة" required icon={Users}
            value={tx.aidRel} error={errors.aidRel}
            onChange={e => update("aidRel", e.target.value)}
            disabled={!tx.aidCategory}
          >
            <option value="">-- اختر --</option>
            {(AID_RELS[tx.aidCategory] || []).map(r => <option key={r} value={r}>{r}</option>)}
          </ERPSelect>

          <div className="sm:col-span-2 space-y-1 z-[60]">
            <ArabicDatePicker label="تاريخ واقعة الإعانة" value={tx.incidentDate} maxVal={tx.date} onChange={v => update("incidentDate", v)} />
          </div>

          {tx.aidCategory && tx.aidRel && (
            <div className="sm:col-span-2 flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-xl">
              <Info size={14} className="text-rose-500 shrink-0"/>
              <p className="text-[10px] font-black text-rose-700 dark:text-rose-400">
                المبلغ المقترح حسب لائحة النقابة:
                <span className="mr-1 text-rose-600 dark:text-rose-300">
                  {(AID_AMOUNTS[`${tx.aidCategory}:${tx.aidRel}`] || 300).toLocaleString()} ج.م
                </span>
              </p>
            </div>
          )}
        </ERPSection>
      )}

      {/* ── 6. ✨ بيانات الفاعلية (صرف شيك نشاط) ── */}
      {tx.type === "activity" && (
        <ERPSection
          title="تفاصيل الفاعلية — شيك دعم النشاط"
          icon={Activity} colorClass="amber" zIndex="z-[70]"
          badge="جديد"
        >
          {/* اسم الفاعلية */}
          <ERPInput
            label="اسم الفاعلية / الحدث" required fullWidth
            value={tx.activityName || ""}
            onChange={e => update("activityName", e.target.value)}
            error={errors.activityName}
            icon={Tag}
            placeholder="مثال: رحلة شرم الشيخ الصيفية"
          />

          {/* نوع الفاعلية */}
          <ERPSelect
            label="نوع الفاعلية" required icon={Tag}
            value={tx.activityType || ""} error={errors.activityType}
            onChange={e => update("activityType", e.target.value)}
          >
            <option value="">-- حدد النوع --</option>
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </ERPSelect>

          {/* موعد الفاعلية */}
          <div className="space-y-1">
            <ArabicDatePicker label="موعد الفاعلية المقرر" value={tx.activityDate || ""} onChange={v => update("activityDate", v)} />
          </div>

          {/* عدد المشاركين */}
          <ERPInput
            label="عدد المشاركين المتوقع"
            value={tx.participantsCount || ""}
            onChange={e => update("participantsCount", e.target.value)}
            isNumeric icon={Users}
            placeholder="عدد الأشخاص"
          />

          {/* موقع الفاعلية */}
          <ERPInput
            label="موقع / وجهة الفاعلية" fullWidth
            value={tx.activityLocation || ""}
            onChange={e => update("activityLocation", e.target.value)}
            icon={MapPin}
            placeholder="مثال: شرم الشيخ / قاعة النقابة"
          />

          {/* تلميح */}
          <div className="sm:col-span-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 rounded-xl">
            <Info size={14} className="text-amber-600 mt-0.5 shrink-0"/>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
              يُمثل هذا المستند شيك دعم فاعلية ويُخصم من رصيد الخزينة. تأكد من اعتماد رئيس المجلس قبل الصرف.
            </p>
          </div>
        </ERPSection>
      )}

      {/* ── 7. الملاحظات والمرفقات ── */}
      <ERPSection title="البيان التوضيحي والمرفقات" icon={FileText} colorClass="indigo" zIndex="z-[50]">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase pr-1">
            {tx.type === "activity" ? "تفاصيل إضافية / بند الصرف" : "ملاحظات وبيان السند"}
          </label>
          <textarea
            rows={3}
            className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold resize-none outline-none focus:ring-2", T.inp)}
            value={tx.notes}
            onChange={e => update("notes", e.target.value)}
            placeholder={tx.type === "activity" ? "اكتب تفاصيل بنود الصرف والميزانية..." : "اكتب التفاصيل والمستندات المرفقة..."}
          />
        </div>
        <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <FileUpload existingFiles={tx.attachments || []} onChange={files => update("attachments", files)} />
        </div>
      </ERPSection>

      {/* ── شريط الأزرار السفلي ── */}
      <div className={clsx(
        "flex flex-wrap justify-between items-center gap-3 p-3 px-4",
        "sticky bottom-2 z-[100] backdrop-blur-xl rounded-2xl shadow-xl border",
        T.card
      )}>
        {/* معلومات سريعة */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] font-bold text-slate-500">
          {tx.checkNum && <span className="flex items-center gap-1"><Hash size={12}/> شيك #{tx.checkNum}</span>}
          {tx.amount && <span className="text-emerald-600 font-black">{Number(tx.amount).toLocaleString()} ج.م</span>}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button" onClick={onCancel}
            className={clsx("flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs border transition-colors", T.btn)}
          >
            إلغاء
          </button>

          {!isEdit && tx.type !== "deposit" && (
            <button
              type="button"
              onClick={() => { if (validate()) printVoucher?.(tx); }}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-black text-[10px] flex items-center gap-1.5 border transition-all"
            >
              <Printer size={13}/> طباعة سند
            </button>
          )}

          <button
            type="button" onClick={save} disabled={saving}
            className={clsx(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-7 py-2.5 rounded-xl font-black text-xs transition-all shadow-md active:scale-95",
              `bg-${color}-600 hover:bg-${color}-700 text-white disabled:opacity-50`
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
            {isEdit ? "تحديث السند" : "حفظ السند"}
          </button>
        </div>
      </div>
    </div>
  );
}
