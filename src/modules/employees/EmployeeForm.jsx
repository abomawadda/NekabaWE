import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useT } from "../../app/providers/ThemeProvider";
import DynamicSelect from "../../ui/inputs/DynamicSelect";
import {
  User, Phone, Mail, CreditCard, Briefcase, Calendar,
  Save, X, Building, MapPin, Plus, UserCircle, Search,
  ShieldCheck, Map, GraduationCap, Upload, FileText, Trash2, Check, Heart, AlertCircle,
  ChevronRight, ChevronLeft, MessageSquare, Award, PhoneCall, Users, Home,
  DollarSign, Landmark, Star, Clipboard, Badge, TrendingUp, Shield,
  Stethoscope, Camera, Hash, Info, CheckCircle2
} from "lucide-react";
import clsx from "clsx";

// ============================================================
// ثوابت البيانات
// ============================================================

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", 
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];
const DAYS_AR = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

const GOVS = { 
  "01": "القاهرة", "02": "الإسكندرية", "03": "بورسعيد", "04": "السويس", 
  "11": "دمياط", "12": "الدقهلية", "13": "الشرقية", "14": "القليوبية", 
  "15": "كفر الشيخ", "16": "الغربية", "17": "المنوفية", "18": "البحيرة", 
  "19": "الإسماعيلية", "21": "الجيزة", "22": "بني سويف", "23": "الفيوم", 
  "24": "المنيا", "25": "أسيوط", "26": "سوهاج", "27": "قنا", "28": "أسوان", 
  "29": "الأقصر", "31": "البحر الأحمر", "32": "الوادي الجديد", "33": "مطروح", 
  "34": "شمال سيناء", "35": "جنوب سيناء", "88": "خارج الجمهورية" 
};

const MARITAL   = ["أعزب", "متزوج", "مطلق", "أرمل"];
const GRADES    = ["وزير مفوض", "كبيرة", "الأولى", "الثانية", "الثالثة", "الرابعة", "عقود", "يومية"];
const QUALS     = ["بدون مؤهل", "دبلوم متوسط", "مؤهل فوق متوسط", "عالي (بكالوريوس/ليسانس)", "ماجستير", "دكتوراه"];
const BLOOD_TYPES = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];

// 🎯 الثوابت المحدثة بناءً على طلبك
const MEMBERSHIP_TYPES = [
  "عضو جمعية عمومية", 
  "رئيس المجلس", 
  "الأمين العام", 
  "أمين الصندوق", 
  "عضو مجلس إدارة", 
  "نقابة مستقلة"
];

// 🎯 حالة العضوية المضافة حديثاً
const MEMBER_STATE = [
  "نشط", 
  "موقوف", 
  "إجازة بدون أجر", 
  "معاش", 
  "استقالة", 
  "وفاة"
];

const SUBSCRIPTION_STATUS = ["مسدد", "متأخر", "معفي", "موقوف"];
const INSURANCE_TYPES = ["تأمين صحي حكومي", "تأمين خاص", "كلاهما", "لا يوجد"];

const TABS = [
  { id: "identity",    label: "الهوية",     icon: ShieldCheck,  color: "teal"   },
  { id: "job",         label: "الوظيفة",    icon: Briefcase,    color: "sky"    },
  { id: "union",       label: "النقابة",    icon: Star,         color: "amber"  },
  { id: "financial",   label: "المالية",    icon: DollarSign,   color: "emerald"},
  { id: "contact",     label: "التواصل",    icon: PhoneCall,    color: "purple" },
  { id: "medical",     label: "الصحة",      icon: Stethoscope,  color: "rose"   },
  { id: "attachments", label: "المرفقات",   icon: FileText,     color: "slate"  },
];

// ============================================================
// دوال مساعدة
// ============================================================

const toEn = (str) => {
  if (!str && str !== 0) return "";
  return str.toString()
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - "٠".charCodeAt(0) + 48))
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - "۰".charCodeAt(0) + 48));
};

const fmtDate = (d) => {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const parseDateStr = (str) => {
  if (!str || str === "—") return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

const addYearsToStr = (dateStr, years) => {
  if (!dateStr || dateStr === "—") return undefined;
  const [d, m, y] = dateStr.split("/").map(Number);
  if (!y) return undefined;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + years}`;
};

const calcYearsService = (hireDateStr) => { 
  if (!hireDateStr) return null; 
  const [d, m, y] = hireDateStr.split("/").map(Number); 
  if (!y) return null; 
  const hire = new Date(y, m - 1, d); 
  const now = new Date(); 
  const yrs = now.getFullYear() - hire.getFullYear(); 
  const mth = now.getMonth() - hire.getMonth(); 
  return mth < 0 ? yrs - 1 : yrs; 
};

const calcAge = (birthDateStr) => { 
  if (!birthDateStr) return null; 
  const [d, m, y] = birthDateStr.split("/").map(Number); 
  if (!y) return null; 
  const birth = new Date(y, m - 1, d); 
  const now = new Date(); 
  let age = now.getFullYear() - birth.getFullYear(); 
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--; 
  return age; 
};

const genMembershipId = () => {
  return "SY-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 99999)).padStart(5, "0");
};

// ============================================================
// المكونات الفرعية
// ============================================================

const ERPSection = ({ title, icon: Icon, colorClass, children, T, cols = 4 }) => (
  <div className={clsx("p-4 rounded-xl border shadow-sm space-y-3 transition-all", T.card)}>
    <div className="flex items-center gap-2 border-b pb-2 border-slate-100 dark:border-slate-800">
      <div className={clsx("p-1.5 rounded-lg", `bg-${colorClass}-500/10`)}>
        <Icon size={14} className={`text-${colorClass}-500`} />
      </div>
      <h3 className={clsx("font-black text-xs uppercase tracking-wider", T.text)}>
        {title}
      </h3>
    </div>
    <div className={clsx(
      "grid grid-cols-1 md:grid-cols-2 gap-3",
      cols === 4 && "lg:grid-cols-4",
      cols === 3 && "lg:grid-cols-3",
      cols === 2 && "lg:grid-cols-2"
    )}>
      {children}
    </div>
  </div>
);

const ERPInput = ({ label, icon: Icon, error, isDerived, isNumeric, hint, ...props }) => {
  const T = useT();

  const handleChange = useCallback((e) => {
    if (isNumeric) {
      const converted = toEn(e.target.value);
      const syntheticEvent = { ...e, target: { ...e.target, value: converted } };
      if (props.onChange) props.onChange(syntheticEvent);
    } else { 
      if (props.onChange) props.onChange(e); 
    }
  }, [isNumeric, props.onChange]);

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase pr-1 flex justify-between items-center">
        <span>{label}</span>
        <span className="flex gap-1">
          {isDerived && <span className="text-teal-500 font-bold normal-case">(آلي)</span>}
          {hint && <span title={hint} className="text-slate-300 cursor-help"><Info size={10}/></span>}
        </span>
      </label>
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
          onChange={handleChange} 
          inputMode={isNumeric ? "numeric" : props.type === "email" ? "email" : "text"} 
          className={clsx(
            "w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none transition-all", 
            Icon ? "pr-9" : "pr-3", 
            isDerived ? "bg-slate-50/50 dark:bg-slate-900/30 cursor-not-allowed opacity-70" : clsx(T.inp, "focus:ring-2 focus:border-teal-500"), 
            error && "!border-rose-500 bg-rose-50/10 ring-2 ring-rose-500/20"
          )} 
          readOnly={isDerived} 
        />
      </div>
      {error && (
        <p className="text-[9px] text-rose-500 font-black pr-1 mt-0.5 flex items-center gap-1">
          <AlertCircle size={9}/> {error}
        </p>
      )}
    </div>
  );
};

const ArabicDatePicker = ({ label, value, onChange, minDate, maxDate, T }) => {
  const [open, setOpen] = useState(false);
  const [vDate, setVDate] = useState(new Date());
  const ref = useRef(null);
  
  const years = useMemo(() => Array.from({ length: 80 }, (_, i) => 1950 + i), []);

  useEffect(() => {
    const h = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) setOpen(false); 
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const onSelect = useCallback((d) => { 
    onChange(fmtDate(new Date(vDate.getFullYear(), vDate.getMonth(), d))); 
    setOpen(false); 
  }, [vDate, onChange]);

  const rawDay = new Date(vDate.getFullYear(), vDate.getMonth(), 1).getDay();
  const firstDay = (rawDay + 1) % 7;
  const totalDays = new Date(vDate.getFullYear(), vDate.getMonth() + 1, 0).getDate();
  
  const [selD, selM, selY] = (value || "").split("/").map(Number);
  const isSelected = (d) => selD === d && selM === vDate.getMonth() + 1 && selY === vDate.getFullYear();
  const isToday = (d) => { 
    const now = new Date(); 
    return d === now.getDate() && vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear(); 
  };

  const minD = parseDateStr(minDate);
  const maxD = parseDateStr(maxDate);
  
  const isDateDisabled = (d) => {
    const curr = new Date(vDate.getFullYear(), vDate.getMonth(), d);
    curr.setHours(0,0,0,0);
    if (minD) { 
      minD.setHours(0,0,0,0); 
      if (curr < minD) return true; 
    }
    if (maxD) { 
      maxD.setHours(0,0,0,0); 
      if (curr > maxD) return true; 
    }
    return false;
  };

  return (
    <div className="relative space-y-1" ref={ref}>
      <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">{label}</label>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        className={clsx(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all focus:ring-2 focus:border-teal-500", 
          T.inp
        )}
      >
        <span className={value ? "" : "text-slate-400"}>{value || "يوم / شهر / سنة"}</span>
        <Calendar size={14} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className={clsx("absolute z-[200] top-full mt-1 w-64 p-3 rounded-2xl shadow-2xl border animate-in fade-in zoom-in-95 duration-150", T.card)} style={{ minWidth: "240px" }}>
          <div className="flex items-center justify-between mb-2 gap-1">
            <button 
              type="button" 
              onClick={() => setVDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} 
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronRight size={14}/>
            </button>
            <div className="flex gap-1 text-[10px] font-black flex-1 justify-center">
              <select 
                value={vDate.getMonth()} 
                onChange={e => setVDate(d => new Date(d.getFullYear(), parseInt(e.target.value)))} 
                className="bg-transparent outline-none cursor-pointer text-center"
              >
                {MONTHS_AR.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select 
                value={vDate.getFullYear()} 
                onChange={e => setVDate(d => new Date(parseInt(e.target.value), d.getMonth()))} 
                className="bg-transparent outline-none cursor-pointer"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button 
              type="button" 
              onClick={() => setVDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} 
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronLeft size={14}/>
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS_AR.map(d => (
              <div key={d} className="text-[9px] font-black text-center text-slate-400 py-0.5">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-0.5">
            {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
              const disabled = isDateDisabled(d);
              return (
                <button 
                  type="button" 
                  key={d} 
                  disabled={disabled} 
                  onClick={() => onSelect(d)} 
                  className={clsx(
                    "py-1 text-[10px] font-bold rounded-lg transition-all", 
                    disabled ? "opacity-20 cursor-not-allowed" : 
                    isSelected(d) ? "bg-teal-500 text-white shadow-sm" : 
                    isToday(d) ? "border border-teal-400 text-teal-600" : "hover:bg-teal-500/10 hover:text-teal-600"
                  )}
                >
                  {d}
                </button>
              )
            })}
          </div>
          
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button" 
              onClick={() => { 
                if(!isDateDisabled(new Date().getDate())) { 
                  onChange(fmtDate(new Date())); 
                  setOpen(false); 
                } 
              }} 
              className="w-full text-[10px] font-black text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 py-1 rounded-lg transition-colors"
            >
              تحديد اليوم الحالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileCard = ({ emp, T }) => {
  const age  = calcAge(emp.birthDate);
  const yrs  = calcYearsService(emp.hireDate);
  
  return (
    <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card, ["وفاة", "استقالة"].includes(emp.memberState) && "border-rose-200 dark:border-rose-900/50 bg-rose-50/10")}>
      <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
        
        {/* الصورة */}
        <div className="relative flex-shrink-0">
          <div className={clsx("w-20 h-20 rounded-2xl border-2 overflow-hidden flex items-center justify-center shadow-md", ["وفاة", "استقالة"].includes(emp.memberState) ? "border-rose-500/30 bg-rose-100 dark:bg-rose-900/30" : "border-teal-500/20 bg-gradient-to-br from-teal-50 to-sky-100 dark:from-teal-900/30 dark:to-sky-900/20")}>
            {emp.photo ? (
              <img src={emp.photo} className="w-full h-full object-cover" alt="صورة الموظف"/>
            ) : (
              <UserCircle size={40} className={["وفاة", "استقالة"].includes(emp.memberState) ? "text-rose-400" : "text-teal-400"}/>
            )}
          </div>
        </div>

        {/* تفاصيل الموظف */}
        <div className="flex-1 min-w-0 text-center md:text-right">
          <h2 className={clsx("font-black text-lg truncate", ["وفاة", "استقالة"].includes(emp.memberState) ? "text-rose-900 dark:text-rose-400 line-through opacity-80" : T.text)}>
            {emp.name || <span className="text-slate-400">ملف عضو جديد</span>}
          </h2>
          <p className={clsx("text-xs font-bold truncate mt-0.5", T.muted)}>
            {[emp.jobTitle, emp.workplace].filter(Boolean).join(" — ") || "لم تُحدَّد تفاصيل الوظيفة ومكان العمل بعد"}
          </p>
          
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
            {emp.jobId && (
              <span className="flex items-center gap-1 text-[10px] font-black bg-sky-500/10 text-sky-600 px-2 py-0.5 rounded-lg border border-sky-500/20">
                <Hash size={12}/> كود: {emp.jobId}
              </span>
            )}
            {emp.membershipId && (
              <span className="flex items-center gap-1 text-[10px] font-black bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-lg border border-amber-500/20">
                <Star size={12}/> {emp.membershipId}
              </span>
            )}
            {emp.membershipStatus && (
              <span className={clsx("text-[10px] font-black px-2 py-0.5 rounded-lg text-white shadow-sm bg-teal-500")}>
                {emp.membershipStatus}
              </span>
            )}
            {emp.memberState && emp.memberState !== "نشط" && (
              <span className={clsx("text-[10px] font-black px-2 py-0.5 rounded-lg text-white shadow-sm", ["وفاة", "استقالة"].includes(emp.memberState) ? "bg-rose-500" : "bg-amber-500")}>
                {emp.memberState}
              </span>
            )}
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="hidden lg:flex gap-4 text-center border-r border-slate-100 dark:border-slate-800 pr-4">
          {age !== null && (
            <div className="space-y-0.5">
              <p className="text-2xl font-black text-teal-600">{age}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">العمر</p>
            </div>
          )}
          {yrs !== null && (
            <div className="space-y-0.5">
              <p className="text-2xl font-black text-sky-600">{yrs}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">سنة خدمة</p>
            </div>
          )}
          {emp.jobGrade && (
            <div className="space-y-0.5">
              <div className="h-8 flex items-end justify-center">
                <p className="text-sm font-black text-amber-600">{emp.jobGrade}</p>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">الدرجة</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

const TabBar = ({ activeTab, setActiveTab, completeness, T }) => (
  <div className={clsx("flex gap-1.5 p-1.5 rounded-xl border shadow-sm overflow-x-auto hide-scrollbar", T.card)}>
    {TABS.map(tab => {
      const Icon = tab.icon; 
      const isActive = activeTab === tab.id; 
      const pct = completeness[tab.id] || 0;
      return (
        <button 
          key={tab.id} 
          type="button" 
          onClick={() => setActiveTab(tab.id)} 
          className={clsx(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black whitespace-nowrap transition-all flex-shrink-0 relative border", 
            isActive 
              ? `bg-${tab.color}-600 text-white shadow-sm border-${tab.color}-500 transform scale-105 z-10` 
              : `bg-${tab.color}-50 text-${tab.color}-600 hover:bg-${tab.color}-100 border-${tab.color}-100 dark:bg-${tab.color}-900/20 dark:border-${tab.color}-900/30`
          )}
        >
          <Icon size={14}/> 
          <span className="hidden sm:inline">{tab.label}</span>
          
          {pct === 100 && !isActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center border border-white dark:border-slate-900 shadow-sm">
              <Check size={8} className="text-white"/>
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// ============================================================
// المكوّن الرئيسي: EmployeeForm
// ============================================================
export default function EmployeeForm({ initialData, modalMode, onSave, onCancel, employeesDB = [] }) {
  const T = useT();

  const getEmptyEmp = () => ({
    name: "", nationalId: "", jobId: "", phone: "", phone2: "", email: "",
    membershipStatus: "عضو جمعية عمومية", memberState: "نشط", attachments: [], // 🎯 القيم الافتراضية
    membershipId: genMembershipId()
  });

  const [emp, setEmp] = useState(getEmptyEmp());
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("identity");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [promotions, setPromotions] = useState([]);
  
  const photoRef = useRef(null);

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setEmp({ 
        ...initialData, 
        membershipStatus: initialData.membershipStatus || "عضو جمعية عمومية", 
        memberState: initialData.memberState || "نشط", 
        attachments: initialData.attachments || [], 
        membershipId: initialData.membershipId || genMembershipId() 
      });
      setPromotions(initialData.promotions || []);
    } else {
      setEmp(getEmptyEmp());
      setPromotions([]);
    }
    setErrors({}); 
    setIsDirty(false); 
    setActiveTab("identity");
  }, [initialData]);

  const upd = useCallback((fields) => { 
    setEmp(prev => ({ ...prev, ...fields })); 
    setIsDirty(true); 
  }, []);
  
  const showToast = useCallback((msg, type = "success") => { 
    setToast({ msg, type }); 
    setTimeout(() => setToast(null), 3500); 
  }, []);

  useEffect(() => {
    const nid = toEn(emp.nationalId || "");
    if (nid.length !== 14 || !/^\d{14}$/.test(nid)) return;

    const century = nid[0] === "3" ? "20" : "19"; 
    const yr = century + nid.substring(1, 3); 
    const mo = nid.substring(3, 5); 
    const dy = nid.substring(5, 7); 
    const govCode = nid.substring(7, 9); 
    const seq = parseInt(nid.substring(9, 13));
    
    const gender = seq % 2 === 0 ? "أنثى" : "ذكر"; 
    const gov = GOVS[govCode] || "محافظة أخرى"; 
    const birthDt = `${dy}/${mo}/${yr}`;
    
    const bYr = parseInt(yr); 
    const retAge = bYr >= 1979 ? 65 : bYr >= 1971 ? 61 : 60; 
    const retDt = `${dy}/${mo}/${bYr + retAge}`;
    
    upd({ gender, birthDate: birthDt, placeOfBirth: gov, retirementDate: retDt });
  }, [emp.nationalId, upd]);

  const validate = useCallback(() => {
    const e = {};
    if (!emp.name || emp.name.trim().split(/\s+/).length < 3) e.name = "الاسم الثلاثي مطلوب";
    if (emp.name && employeesDB.some(x => x.name === emp.name && x.id !== emp.id)) e.name = "الاسم مسجل مسبقاً لعضو آخر";

    const nid = toEn(emp.nationalId || "");
    if (!nid || nid.length !== 14 || !/^\d{14}$/.test(nid)) e.nationalId = "يجب إدخال 14 رقماً";
    if (nid && employeesDB.some(x => x.nationalId === nid && x.id !== emp.id)) e.nationalId = "الرقم القومي مسجل مسبقاً لعضو آخر";

    if (!emp.jobId?.trim()) e.jobId = "الكود الوظيفي مطلوب";
    if (emp.jobId && employeesDB.some(x => x.jobId === emp.jobId && x.id !== emp.id)) e.jobId = "الكود الوظيفي مسجل مسبقاً";

    const p1 = toEn(emp.phone || "").trim();
    if (!p1) { e.phone = "مطلوب رقم أساسي للتواصل"; } else if (p1.length !== 11 || !p1.startsWith("01")) { e.phone = "يجب أن يكون 11 رقماً ويبدأ بـ 01"; }
    
    const p2 = toEn(emp.phone2 || "").trim();
    if (p2 && (p2.length !== 11 || !p2.startsWith("01"))) { e.phone2 = "يجب أن يكون 11 رقماً ويبدأ بـ 01"; }

    if (emp.email && emp.email.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp.email)) e.email = "صيغة البريد الإلكتروني غير صحيحة";
    }

    setErrors(e);
    const hasErrors = Object.keys(e).length > 0;
    
    if (hasErrors) { 
      showToast("يرجى إكمال البيانات الإلزامية وتصحيح الأخطاء", "error"); 
      if (e.name || e.nationalId) setActiveTab("identity"); 
      else if (e.jobId) setActiveTab("job"); 
      else if (e.phone || e.phone2 || e.email) setActiveTab("contact"); 
    }
    return !hasErrors;
  }, [emp, employeesDB, showToast]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    
    showToast("جاري توثيق السجل...");
    await onSave({ ...emp, promotions, updatedAt: new Date().toISOString() });
    setIsDirty(false);
    
    if (modalMode === 'add') {
      setEmp(getEmptyEmp());
      setPromotions([]);
      setActiveTab("identity");
      setErrors({});
    }
  }, [validate, emp, promotions, onSave, showToast, modalMode]);

  const searchRes = useMemo(() => {
    if (!q || q.length < 2) return []; 
    const lower = q.toLowerCase();
    return employeesDB.filter(x => 
      x.name?.includes(q) || x.jobId?.includes(q) || x.nationalId?.includes(q) || 
      x.phone?.includes(q) || x.membershipId?.toLowerCase().includes(lower)
    ).slice(0, 5);
  }, [q, employeesDB]);

  const completeness = useMemo(() => {
    const has = (v) => !!v?.toString().trim();
    return {
      identity: [emp.name, emp.nationalId, emp.gender, emp.birthDate, emp.maritalStatus].filter(has).length / 5 * 100,
      job: [emp.jobId, emp.workplace, emp.jobTitle, emp.jobGrade, emp.hireDate, emp.qualification].filter(has).length / 6 * 100,
      union: [emp.membershipId, emp.membershipStatus, emp.unionBranch, emp.subscriptionStatus].filter(has).length / 4 * 100,
      financial: [emp.basicSalary, emp.allowances, emp.insuranceNumber].filter(has).length / 3 * 100,
      contact: [emp.phone, emp.address].filter(has).length / 2 * 100,
      medical: [emp.bloodType, emp.insuranceType].filter(has).length / 2 * 100,
      attachments: emp.attachments?.length > 0 ? 100 : 0,
    };
  }, [emp]);

  const renderTabContent = () => {
    switch (activeTab) {
      
      case "identity": return (
        <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
          <ERPSection title="بيانات الهوية الشخصية" icon={ShieldCheck} colorClass="teal" T={T}>
            <div className="md:col-span-2 lg:col-span-2">
              <ERPInput label="الاسم الرباعي الكامل *" value={emp.name || ""} onChange={e => upd({ name: e.target.value })} error={errors.name} icon={User} />
            </div>
            
            <ERPInput label="الرقم القومي (14 رقم) *" value={emp.nationalId || ""} onChange={e => upd({ nationalId: toEn(e.target.value) })} maxLength={14} isNumeric icon={CreditCard} error={errors.nationalId} />
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">الحالة الاجتماعية</label>
              <select value={emp.maritalStatus || ""} onChange={e => upd({ maritalStatus: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-teal-500", T.inp)}>
                <option value="">اختر...</option>
                {MARITAL.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <ERPInput label="الجنس" value={emp.gender || "—"} isDerived icon={Award} />
            <ERPInput label="تاريخ الميلاد" value={emp.birthDate || "—"} isDerived icon={Calendar} />
            <ERPInput label="محافظة الميلاد" value={emp.placeOfBirth || "—"} isDerived icon={Map} />
            <ERPInput label="تاريخ الخروج للمعاش" value={emp.retirementDate || "—"} isDerived icon={Calendar} />
            <ERPInput label="عدد الأبناء" value={emp.childrenCount || ""} onChange={e => upd({ childrenCount: e.target.value })} isNumeric icon={Users} />
          </ERPSection>
        </div>
      );
      
      case "job": return (
        <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
          <ERPSection title="السجل الوظيفي ومكان العمل" icon={Briefcase} colorClass="sky" T={T}>
            <ERPInput label="الكود الوظيفي *" value={emp.jobId || ""} onChange={e => upd({ jobId: e.target.value })} isNumeric icon={Hash} error={errors.jobId} />
            
            <DynamicSelect label="مكان العمل / السنترال" listKey="workplaces" value={emp.workplace} onChange={v => upd({ workplace: v })} icon={Building} defaultOptions={["سنترال المنصورة الرئيسي", "سنترال طلخا", "سنترال ميت غمر"]} />
            <DynamicSelect label="المسمى الوظيفي" listKey="jobTitles" value={emp.jobTitle} onChange={v => upd({ jobTitle: v })} icon={Briefcase} defaultOptions={["محاسب", "مهندس", "فني", "خدمة عملاء", "أمين مخزن", "مراجع"]} />

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">الدرجة الوظيفية</label>
              <select value={emp.jobGrade || ""} onChange={e => upd({ jobGrade: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-sky-500", T.inp)}>
                <option value="">اختر الدرجة...</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            
            <ArabicDatePicker label="تاريخ التعيين" value={emp.hireDate} onChange={v => upd({ hireDate: v })} maxDate={fmtDate(new Date())} minDate={addYearsToStr(emp.birthDate, 18)} T={T} />
            <ArabicDatePicker label="تاريخ آخر ترقية" value={emp.lastPromotionDate} onChange={v => upd({ lastPromotionDate: v })} minDate={emp.hireDate} maxDate={fmtDate(new Date())} T={T} />
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">المؤهل الدراسي</label>
              <select value={emp.qualification || ""} onChange={e => upd({ qualification: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-sky-500", T.inp)}>
                <option value="">اختر المؤهل...</option>
                {QUALS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            
            <ERPInput label="التخصص / مجال العمل" value={emp.specialization || ""} onChange={e => upd({ specialization: e.target.value })} icon={GraduationCap} />
          </ERPSection>

          <div className={clsx("p-4 rounded-xl border space-y-3 shadow-sm", T.card)}>
            <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 font-black text-[11px] uppercase text-amber-600">
                <TrendingUp size={14}/> سجل الحركات الوظيفية ({promotions.length})
              </div>
              <button type="button" onClick={() => setPromotions(prev => [...prev, { id: Date.now(), date: fmtDate(new Date()), from: "", to: "", note: "" }])} className="text-[10px] font-black bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors shadow-sm active:scale-95 flex items-center gap-1">
                <Plus size={12}/> إضافة حركة
              </button>
            </div>
            
            {promotions.length === 0 && (
              <p className="text-center text-slate-400 text-[10px] font-bold py-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-dashed">
                لا توجد حركات ترقية مسجلة
              </p>
            )}
            
            <div className="space-y-2">
              {promotions.map((pr, idx) => (
                <div key={pr.id} className={clsx("p-3 rounded-lg border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 relative group", T.sxn)}>
                  <button type="button" onClick={() => setPromotions(prev => prev.filter(x => x.id !== pr.id))} className="absolute -top-2 -right-2 p-1 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-full opacity-0 group-hover:opacity-100 shadow-sm transition-all z-10" title="حذف الحركة"><Trash2 size={12}/></button>
                  <ArabicDatePicker label="التاريخ" value={pr.date} onChange={v => setPromotions(prev => prev.map(x => x.id === pr.id ? { ...x, date: v } : x))} minDate={emp.hireDate} maxDate={fmtDate(new Date())} T={T} />
                  <ERPInput label="من درجة/وظيفة" value={pr.from} onChange={e => setPromotions(prev => prev.map(x => x.id === pr.id ? { ...x, from: e.target.value } : x))} icon={Award} />
                  <ERPInput label="إلى درجة/وظيفة" value={pr.to}   onChange={e => setPromotions(prev => prev.map(x => x.id === pr.id ? { ...x, to:   e.target.value } : x))} icon={TrendingUp} />
                  <ERPInput label="ملاحظة أو قرار"  value={pr.note} onChange={e => setPromotions(prev => prev.map(x => x.id === pr.id ? { ...x, note: e.target.value } : x))} icon={Clipboard} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
      
      case "union": return (
        <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
          <ERPSection title="بيانات العضوية النقابية" icon={Star} colorClass="amber" T={T} cols={3}>
            <ERPInput label="رقم العضوية (كود النقابة)" value={emp.membershipId || ""} onChange={e => upd({ membershipId: e.target.value })} icon={Badge} hint="يُولَّد تلقائياً" />
            
            {/* 🎯 قائمة اختيار طبيعة العضوية الجديدة */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">طبيعة العضوية (الصفة)</label>
              <select value={emp.membershipStatus || ""} onChange={e => upd({ membershipStatus: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-amber-500", T.inp)}>
                <option value="">اختر...</option>
                {MEMBERSHIP_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* 🎯 قائمة حالة العضوية الجديدة (نشط، وفاة، استقالة...) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">حالة العضوية الحالية</label>
              <select value={emp.memberState || "نشط"} onChange={e => upd({ memberState: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-black appearance-none outline-none focus:ring-2 focus:border-amber-500", T.inp, ["وفاة", "استقالة"].includes(emp.memberState) && "text-rose-600 bg-rose-50 border-rose-200")}>
                {MEMBER_STATE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <DynamicSelect label="الفرع النقابي التابع له" listKey="unionBranches" value={emp.unionBranch} onChange={v => upd({ unionBranch: v })} icon={Building} defaultOptions={["النقابة العامة", "اللجنة النقابية بالمنصورة", "اللجنة النقابية بطلخا"]} />
            <ArabicDatePicker label="تاريخ الانتساب للنقابة" value={emp.unionJoinDate} onChange={v => upd({ unionJoinDate: v })} minDate={emp.hireDate || addYearsToStr(emp.birthDate, 18)} maxDate={fmtDate(new Date())} T={T} />
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">حالة الاشتراك المالي</label>
              <select value={emp.subscriptionStatus || ""} onChange={e => upd({ subscriptionStatus: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-amber-500", T.inp)}>
                <option value="">اختر الحالة...</option>
                {SUBSCRIPTION_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <ERPInput label="رقم شهادة العضوية (إن وجد)" value={emp.membershipCertNo || ""} onChange={e => upd({ membershipCertNo: e.target.value })} icon={FileText} />
          </ERPSection>
          
          <ERPSection title="الاشتراكات والمستحقات النقابية" icon={DollarSign} colorClass="amber" T={T} cols={3}>
            <ERPInput label="قيمة الاشتراك الشهري (جنيه)" value={emp.monthlySubscription || ""} onChange={e => upd({ monthlySubscription: e.target.value })} isNumeric icon={DollarSign} />
            <ERPInput label="إجمالي الاشتراكات المسددة" value={emp.totalPaidSubscriptions || ""} onChange={e => upd({ totalPaidSubscriptions: e.target.value })} isNumeric icon={CheckCircle2} />
            <ERPInput label="المتأخرات المالية (جنيه)" value={emp.subscriptionArrears || ""} onChange={e => upd({ subscriptionArrears: e.target.value })} isNumeric icon={AlertCircle} />
            <ArabicDatePicker label="تاريخ آخر تجديد للعضوية" value={emp.lastRenewalDate} onChange={v => upd({ lastRenewalDate: v })} maxDate={fmtDate(new Date())} T={T} />
            <ArabicDatePicker label="تاريخ انتهاء كارنيه العضوية" value={emp.membershipExpiry} onChange={v => upd({ membershipExpiry: v })} T={T} />
            <ERPInput label="ملاحظات العضوية" value={emp.membershipNotes || ""} onChange={e => upd({ membershipNotes: e.target.value })} icon={Clipboard} />
          </ERPSection>
        </div>
      );
      
      case "financial": return (
        <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
          <ERPSection title="الراتب الأساسي والمكافآت" icon={DollarSign} colorClass="emerald" T={T}>
            <ERPInput label="الراتب الأساسي الثابت (جنيه)" value={emp.basicSalary || ""} onChange={e => upd({ basicSalary: e.target.value })} isNumeric icon={DollarSign} />
            <ERPInput label="إجمالي البدلات والحوافز (جنيه)" value={emp.allowances || ""} onChange={e => upd({ allowances: e.target.value })} isNumeric icon={Plus} />
            <ERPInput label="صافي المرتب التقديري (جنيه)" value={emp.netSalary || ""} onChange={e => upd({ netSalary: e.target.value })} isNumeric icon={TrendingUp} />
            <ERPInput label="رقم الحساب البنكي (الآيبان)" value={emp.bankAccount || ""} onChange={e => upd({ bankAccount: e.target.value })} isNumeric icon={Landmark} />
            <ERPInput label="اسم البنك المحول عليه" value={emp.bankName || ""} onChange={e => upd({ bankName: e.target.value })} icon={Landmark} />
            <ERPInput label="فرع البنك" value={emp.bankBranch || ""} onChange={e => upd({ bankBranch: e.target.value })} icon={MapPin} />
            <ERPInput label="رقم بطاقة الصرف (فيزا)" value={emp.atmCardNo || ""} onChange={e => upd({ atmCardNo: e.target.value })} isNumeric icon={CreditCard} />
          </ERPSection>
          
          <ERPSection title="التأمينات الاجتماعية" icon={Shield} colorClass="emerald" T={T} cols={3}>
            <ERPInput label="الرقم التأميني" value={emp.insuranceNumber || ""} onChange={e => upd({ insuranceNumber: e.target.value })} isNumeric icon={Shield} />
            <ERPInput label="رقم ملف التأمين" value={emp.insuranceFile || ""} onChange={e => upd({ insuranceFile: e.target.value })} icon={FileText} />
            <ERPInput label="الاستقطاع التأميني الشهري" value={emp.insuranceContrib || ""} onChange={e => upd({ insuranceContrib: e.target.value })} isNumeric icon={DollarSign} />
            <ArabicDatePicker label="تاريخ بداية التأمين" value={emp.insuranceStartDate} onChange={v => upd({ insuranceStartDate: v })} minDate={emp.hireDate} maxDate={fmtDate(new Date())} T={T} />
          </ERPSection>
        </div>
      );
      
      case "contact": return (
        <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
          <ERPSection title="بيانات الاتصال الأساسية" icon={PhoneCall} colorClass="purple" T={T} cols={2}>
            <ERPInput label="رقم الموبايل الأساسي *" value={emp.phone || ""} onChange={e => upd({ phone: e.target.value })} isNumeric icon={Phone} error={errors.phone} placeholder="مثال: 010xxxxxxxx" maxLength={11} />
            <ERPInput label="رقم موبايل إضافي (اختياري)" value={emp.phone2 || ""} onChange={e => upd({ phone2: e.target.value })} isNumeric icon={PhoneCall} error={errors.phone2} placeholder="مثال: 011xxxxxxxx" maxLength={11} />
            <ERPInput label="البريد الإلكتروني الرسمي" type="email" value={emp.email || ""} onChange={e => upd({ email: e.target.value })} icon={Mail} error={errors.email} placeholder="example@domain.com" />
            <ERPInput label="المحافظة" value={emp.governorate || ""} onChange={e => upd({ governorate: e.target.value })} icon={Map} />
            <div className="md:col-span-2"><ERPInput label="العنوان السكني التفصيلي المكتوب في البطاقة" value={emp.address || ""} onChange={e => upd({ address: e.target.value })} icon={Home} /></div>
            <ERPInput label="المدينة / المركز / الحي" value={emp.city || ""} onChange={e => upd({ city: e.target.value })} icon={MapPin} />
          </ERPSection>

          <div className={clsx("p-4 rounded-xl border space-y-3 bg-rose-50/40 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30", T.card)}>
            <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 dark:border-rose-900/40 pb-2 font-black text-[11px] uppercase tracking-widest"><Heart size={14}/> بيانات جهة الاتصال في حالات الطوارئ</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ERPInput label="الاسم الكامل لجهة الطوارئ" value={emp.emergencyName || ""} onChange={e => upd({ emergencyName: e.target.value })} icon={User} />
              <ERPInput label="رقم الهاتف الأساسي" value={emp.emergencyPhone || ""} onChange={e => upd({ emergencyPhone: e.target.value })} isNumeric icon={Phone} />
              <ERPInput label="صلة القرابة بالعضو" value={emp.emergencyRelation || ""} onChange={e => upd({ emergencyRelation: e.target.value })} icon={Users} />
              <ERPInput label="رقم هاتف ثانوي (بديل)" value={emp.emergencyPhone2 || ""} onChange={e => upd({ emergencyPhone2: e.target.value })} isNumeric icon={PhoneCall} />
              <div className="md:col-span-2"><ERPInput label="عنوان السكن لجهة الطوارئ" value={emp.emergencyAddress || ""} onChange={e => upd({ emergencyAddress: e.target.value })} icon={Home} /></div>
            </div>
          </div>
        </div>
      );
      
      case "medical": return (
        <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
          <ERPSection title="البيانات الصحية والتأمين الطبي" icon={Stethoscope} colorClass="rose" T={T} cols={3}>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">فصيلة الدم</label>
              <select value={emp.bloodType || ""} onChange={e => upd({ bloodType: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-rose-500", T.inp)}>
                <option value="">غير معروف...</option>
                {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 pr-1 uppercase">نوع التأمين الصحي المتاح</label>
              <select value={emp.insuranceType || ""} onChange={e => upd({ insuranceType: e.target.value })} className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold appearance-none outline-none focus:ring-2 focus:border-rose-500", T.inp)}>
                <option value="">اختر...</option>
                {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <ERPInput label="رقم بطاقة التأمين الصحي" value={emp.healthCardNo || ""} onChange={e => upd({ healthCardNo: e.target.value })} icon={CreditCard} />
            <ERPInput label="جهة الرعاية الصحية / العيادة" value={emp.healthProvider || ""} onChange={e => upd({ healthProvider: e.target.value })} icon={Stethoscope} />
            <ERPInput label="وجود إعاقة أو حالة خاصة (إن وجد)" value={emp.specialNeeds || ""} onChange={e => upd({ specialNeeds: e.target.value })} icon={Heart} />
            <ERPInput label="ملاحظات طبية هامة" value={emp.medicalNotes || ""} onChange={e => upd({ medicalNotes: e.target.value })} icon={Clipboard} />
          </ERPSection>
        </div>
      );
      
      case "attachments": return (
        <div className={clsx("p-5 rounded-2xl border space-y-4 animate-in slide-in-from-right-4 duration-300", T.card)}>
          <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-teal-600"><FileText size={16}/> الأرشيف والمرفقات الرقمية ({emp.attachments?.length || 0})</div>
            <label className="cursor-pointer bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 shadow-md transition-all active:scale-95 text-[11px] font-black flex items-center gap-1.5">
              <Upload size={14}/> رفع ملف جديد
              <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => { 
                const fs = Array.from(e.target.files).map(f => ({ id: Date.now() + Math.random(), name: f.name, size: f.size > 1024 * 1024 ? (f.size / 1024 / 1024).toFixed(1) + " MB" : (f.size / 1024).toFixed(0) + " KB", type: f.type, uploadedAt: fmtDate(new Date()) })); 
                upd({ attachments: [...(emp.attachments || []), ...fs] }); 
                showToast(`تم رفع ${fs.length} ملف للأرشيف بنجاح`); 
              }} />
            </label>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {emp.attachments?.map(f => (
              <div key={f.id} className={clsx("flex flex-col items-center gap-2 p-3 rounded-xl border group hover:border-teal-500 hover:shadow-md transition-all cursor-pointer relative", T.sxn)}>
                <button type="button" onClick={() => upd({ attachments: emp.attachments.filter(x => x.id !== f.id) })} className="absolute top-1.5 right-1.5 p-1 bg-white dark:bg-slate-800 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 shadow-sm transition-all z-10"><Trash2 size={12}/></button>
                <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", f.name.endsWith(".pdf") ? "bg-rose-100 text-rose-600" : f.type?.startsWith("image/") ? "bg-sky-100 text-sky-600" : "bg-teal-100 text-teal-600")}><FileText size={20}/></div>
                <div className="w-full text-center min-w-0">
                  <p className="text-[10px] font-black truncate w-full" title={f.name}>{f.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">{f.size} · {f.uploadedAt}</p>
                </div>
              </div>
            ))}
            {(!emp.attachments || emp.attachments.length === 0) && (
              <div className="col-span-full flex flex-col items-center justify-center py-10 gap-2 text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed">
                <FileText size={36} className="opacity-20"/>
                <p className="text-xs font-black">لا توجد وثائق أو مرفقات مؤرشفة في ملف العضو</p>
                <p className="text-[10px] font-bold opacity-70">يُفضل رفع (صورة البطاقة، شهادة الميلاد، إخلاء الطرف، المؤهل الدراسي)</p>
              </div>
            )}
          </div>
        </div>
      );
      
      default: return null;
    }
  };

  // ============================================================
  // العرض الرئيسي (Render)
  // ============================================================
  return (
    <div className={clsx("flex flex-col gap-4 pb-20 w-full", T.text)} dir="rtl">
      {toast && (
        <div className={clsx("fixed top-10 left-1/2 -translate-x-1/2 z-[5000] px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 text-white font-bold", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <Check size={16}/>}
          <span className="text-xs">{toast.msg}</span>
        </div>
      )}
      
      <div className={clsx("p-3 px-4 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-3 sticky top-2 z-[100] backdrop-blur-md bg-white/80 dark:bg-slate-900/80", T.card)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative cursor-pointer group flex-shrink-0" onClick={() => photoRef.current.click()} title="تغيير الصورة">
            <div className="w-12 h-12 rounded-xl border-2 border-teal-500/20 overflow-hidden bg-gradient-to-br from-teal-50 to-sky-100 dark:from-teal-900 dark:to-sky-900 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
              {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="صورة الموظف"/> : <UserCircle size={28} className="text-teal-400"/>}
            </div>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity backdrop-blur-sm"><Camera size={14} className="text-white"/></div>
            <input type="file" ref={photoRef} hidden accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onloadend = () => upd({ photo: r.result }); r.readAsDataURL(f); } }} />
          </div>
          
          <div className="hidden md:block min-w-0 flex-1">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{emp.name || "جاري تسجيل عضو جديد..."}</p>
            <p className="text-[10px] font-bold text-teal-600 truncate mt-0.5">{emp.jobTitle || "الوظيفة غير محددة"}</p>
          </div>

          <div className="relative flex-1 max-w-xs hidden lg:block ml-auto">
            <Search size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث واستدعاء سجل آخر..." className={clsx("w-full pr-9 pl-4 py-2 rounded-xl border text-[11px] font-bold outline-none focus:ring-2 focus:border-teal-500 transition-all", T.inp)} />
            {searchRes.length > 0 && (
              <div className={clsx("absolute top-full mt-1 w-full border rounded-2xl shadow-xl overflow-hidden z-[200] animate-in slide-in-from-top-2", T.card)}>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 text-center text-[9px] font-black text-slate-400 border-b">نتائج البحث ({searchRes.length})</div>
                <div className="max-h-60 overflow-y-auto">
                  {searchRes.map(s => (
                    <button key={s.id} type="button" onClick={() => { setEmp(s); setQ(""); showToast(`تم استدعاء بيانات: ${s.name}`); }} className={clsx("w-full p-2.5 flex items-center gap-2.5 text-right hover:bg-teal-50 dark:hover:bg-teal-900/20 border-b last:border-0 transition-colors", T.div)}>
                      <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 font-black text-[9px] flex items-center justify-center flex-shrink-0">{s.jobId || "—"}</div>
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-black truncate">{s.name}</p><p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{s.nationalId} · {s.phone}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {emp.phone && <a href={`https://wa.me/2${toEn(emp.phone.split("-")[0].trim())}`} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-sm transition-all" title="مراسلة عبر واتساب"><MessageSquare size={16}/></a>}
          {isDirty && <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black border border-amber-200 animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"/> غير محفوظ</div>}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"/>
          <button type="button" onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white font-black rounded-xl shadow-sm shadow-teal-600/20 hover:bg-teal-700 hover:-translate-y-0.5 active:translate-y-0 text-xs transition-all"><Save size={14}/> <span className="hidden sm:inline">حفظ البيانات</span></button>
          <button type="button" onClick={onCancel} className={clsx("p-2 rounded-xl border hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors", T.btn)} title="إغلاق المِلَف"><X size={16}/></button>
        </div>
      </div>

      <ProfileCard emp={emp} T={T} />
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} completeness={completeness} T={T} />

      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>

      <div className={clsx("flex flex-col md:flex-row justify-between items-center gap-4 p-4 md:px-6 border-t mt-2 sticky bottom-3 z-40 backdrop-blur-xl rounded-[2rem] border shadow-xl bg-white/90 dark:bg-slate-900/90", T.card)}>
        <div className="flex w-full md:w-1/3 items-center gap-3">
          {(() => {
            const total = Math.round(Object.values(completeness).reduce((a, b) => a + b, 0) / Object.keys(completeness).length);
            return (
              <>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner"><div className={clsx("h-full rounded-full transition-all duration-1000", total > 80 ? "bg-emerald-500" : total > 40 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${total}%` }}/></div>
                <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">مكتمل {total}%</span>
              </>
            );
          })()}
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <button type="button" onClick={onCancel} className={clsx("flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-xs transition-all border hover:bg-slate-50 dark:hover:bg-slate-800", T.btn)}>إلغاء التعديلات</button>
          <button type="button" onClick={handleSave} className="flex-1 md:flex-none px-8 py-2.5 bg-teal-600 text-white font-black rounded-xl shadow-md shadow-teal-600/30 hover:bg-teal-700 active:scale-95 flex items-center justify-center gap-1.5 transition-all text-xs"><CheckCircle2 size={16}/> اعتماد السجل النهائي</button>
        </div>
      </div>
    </div>
  );
}