import React, { useState, useEffect, useCallback } from "react";
import { nextWorkflowState } from "./helpers/workflow";
import WorkflowStepper from "./WorkflowStepper";
import { printVoucher, printAidRequest } from "./VoucherPrint";
import FileUpload from "./FileUpload"; 
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import DynamicSelect from "../../ui/inputs/DynamicSelect";

import {
  Search, Loader2, CheckCircle2, Printer, Landmark,
  FileText, User, Heart, Building, AlertCircle, Hash, DollarSign, UserCheck
} from "lucide-react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useLocation } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import clsx from "clsx";

const DEP_OPTS = ["النقابة العامة بالدقهلية", "أمين الصندوق", "اشتراكات أعضاء", "جهة خارجية"];

const AID_RELS = {
  "إعانة زواج": ["العضو نفسه", "ابن", "ابنة"],
  "إعانة وفاة": ["العضو نفسه", "الزوج", "الزوجة", "أب", "أم", "ابن", "ابنة"],
  "ظروف قهرية / صحية": ["العضو نفسه"],
};

// 🎯 تحديث المسميات
const TYPE_LABELS = { deposit: "سند إيداع (دائن)", aid: "سند صرف إعانة (مدين)", advance: "سند سلفة / عهدة (مدين)", activity: "شيك دعم فاعلية (مدين)" };

const AID_AMOUNTS = {
  "إعانة وفاة:العضو نفسه": 500, "إعانة وفاة:الزوج": 500, "إعانة وفاة:الزوجة": 500,
  "إعانة وفاة:أب": 300, "إعانة وفاة:أم": 300, "إعانة وفاة:ابن": 300, "إعانة وفاة:ابنة": 300,
  "إعانة زواج:العضو نفسه": 500, "إعانة زواج:ابن": 300, "إعانة زواج:ابنة": 300,
  "ظروف قهرية / صحية:العضو نفسه": 300,
};

const getTodayISO = () => new Date().toISOString().split("T")[0];

function ERPSection({ title, icon: Icon, colorClass, children, zIndex = "z-10" }) {
  const T = useT();
  return (
    <div className={clsx(`p-4 rounded-xl border shadow-sm space-y-3 animate-in fade-in duration-500 relative ${zIndex}`, T.card)}>
      <div className="flex items-center gap-2 border-b pb-2 border-slate-100 dark:border-slate-800">
        <div className={clsx("p-1.5 rounded-lg", `bg-${colorClass}-500/10`)}>
          <Icon size={14} className={`text-${colorClass}-500`} />
        </div>
        <h3 className={clsx("font-black text-[11px] uppercase tracking-widest", T.text)}>{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function ERPInput({ label, icon: Icon, error, isNumeric, hint, ...props }) {
  const T = useT();
  return (
    <div className="space-y-1 relative w-full">
      <label className="text-[10px] font-black text-slate-500 uppercase pr-1">{label}</label>
      {hint && <p className="text-[9px] text-teal-500 font-bold -mt-0.5 pr-1">{hint}</p>}
      <div className="relative group">
        {Icon && <Icon size={14} className={clsx("absolute right-3 top-2.5 z-10 transition-colors pointer-events-none", error ? "text-rose-500" : "text-slate-400 group-focus-within:text-teal-500")}/>}
        <input {...props} inputMode={isNumeric ? "numeric" : "text"} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none transition-all h-[38px]", Icon ? "pr-9" : "pr-3", props.disabled ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-70 cursor-not-allowed" : clsx(T.inp, "focus:ring-2 focus:border-teal-500"), error && "!border-rose-500 bg-rose-50/10 focus:ring-rose-300")} />
      </div>
      {error && <p className="text-[9px] text-rose-500 font-black mt-0.5 flex items-center gap-1"><AlertCircle size={10}/> {error}</p>}
    </div>
  );
}

export default function TreasuryForm({ userRole, onSubmit, nextCheque, initialData, onCancel, showToast }) {
  const T = useT();
  const isTreasurer = userRole === "treasurer";
  const isEdit = Boolean(initialData?.id);
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const defaultType = urlParams.get("type") || "deposit";

  const getEmptyTx = () => ({
    type: defaultType, date: getTodayISO(), amount: "", party: "", employeeId: "", notes: "",
    checkNum: defaultType !== "deposit" ? (nextCheque || "") : "", aidCategory: "", aidRel: "", incidentDate: "", attachments: [], state: isTreasurer ? "posted" : "draft",
  });

  const [tx, setTx] = useState(() => isEdit ? { ...initialData } : getEmptyTx());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  
  const [employeesDB, setEmployeesDB] = useState([]); 
  const [searchQ, setSearchQ] = useState(initialData?.party || "");
  const [searchRes, setSearchRes] = useState([]);
  const [showRes, setShowRes] = useState(false);

  const update = useCallback((key, value) => {
    setTx(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, [errors]);

  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(query(collection(db, "employees")));
      setEmployeesDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!searchQ || searchQ.length < 2 || !showRes) { setSearchRes([]); return; }
    const lowerQ = searchQ.toLowerCase();
    const filtered = employeesDB.filter(e => e.name?.toLowerCase().includes(lowerQ) || e.jobId?.toString().includes(lowerQ) || e.nationalId?.includes(lowerQ)).slice(0, 6);
    setSearchRes(filtered);
  }, [searchQ, showRes, employeesDB]);

  useEffect(() => {
    if (tx.type !== "aid" || isEdit) return;
    if (!tx.aidCategory || !tx.aidRel) return;
    const key = `${tx.aidCategory}:${tx.aidRel}`;
    const amt = AID_AMOUNTS[key] || 300;
    update("amount", amt);
  }, [tx.aidCategory, tx.aidRel, tx.type, isEdit]);

  const selectEmployee = (emp) => {
    update("party", emp.name);
    update("employeeId", emp.jobId);
    setSearchQ(emp.name);
    setShowRes(false);
  };

  const performValidation = () => {
    const newErrs = {};
    if (!tx.date) newErrs.date = "مطلوب";
    if (!tx.amount || Number(tx.amount) <= 0) newErrs.amount = "مطلوب رقم موجب";
    if (!tx.party?.trim()) newErrs.party = "الجهة أو العضو مطلوب";
    if (tx.type !== "deposit" && !tx.checkNum) newErrs.checkNum = "رقم الشيك مطلوب";
    if (tx.type === "aid") {
      if (!tx.aidCategory) newErrs.aidCategory = "مطلوب";
      if (!tx.aidRel) newErrs.aidRel = "مطلوب";
    }
    setErrors(newErrs);
    return Object.keys(newErrs).length === 0;
  };

  async function save() {
    if (!performValidation()) return showToast("برجاء استكمال البيانات المطلوبة", "error");

    setSaving(true);
    try {
      await onSubmit(tx, isEdit); 
      if (!isEdit) {
        setTx({ ...getEmptyTx(), checkNum: tx.type !== "deposit" ? Number(tx.checkNum) + 1 : "" });
        setSearchQ("");
      }
    } catch (e) {
      console.error(e);
    } finally { setSaving(false); }
  }

  return (
    <div className={clsx("flex flex-col gap-4 max-w-4xl mx-auto pb-10 animate-in slide-in-from-bottom-8 duration-500 relative", T.text)} dir="rtl">

      <div className={clsx("p-3 px-5 rounded-2xl border shadow-sm flex items-center justify-between sticky top-2 z-[100] backdrop-blur-md bg-white/90 dark:bg-slate-900/90", T.card)}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 rounded-xl text-teal-600"><Landmark size={18}/></div>
          <div>
            <h2 className="text-base font-black tracking-tight">{isEdit ? "تعديل مستند مالي" : "إصدار مستند مالي جديد"}</h2>
            <p className="text-[10px] font-bold text-slate-400">{TYPE_LABELS[tx.type]}</p>
          </div>
        </div>
        <div className="hidden md:block"><WorkflowStepper state={tx.state}/></div>
      </div>

      <ERPSection title="بيانات السند المالية" icon={FileText} colorClass="slate" zIndex="z-[90]">
        <div className="space-y-1">
          <ArabicDatePicker label="تاريخ الحركة" value={tx.date} maxVal={getTodayISO()} onChange={v => update("date", v)} />
          {errors.date && <p className="text-[9px] text-rose-500 font-black">{errors.date}</p>}
        </div>
        <ERPInput label="المبلغ الإجمالي (ج.م)" value={tx.amount} onChange={e => update("amount", e.target.value)} isNumeric error={errors.amount} icon={DollarSign} placeholder="0.00" />
        
        {tx.type !== "deposit" && (
          <div className="space-y-1 relative md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase pr-1 flex justify-between">رقم الشيك البنكي <span className="text-[9px] text-amber-500 font-bold">المقترح: #{nextCheque}</span></label>
            <div className="relative group">
              <Hash size={14} className={clsx("absolute right-3 top-2.5 z-10 pointer-events-none", errors.checkNum ? "text-rose-500" : "text-slate-400")}/>
              <input type="text" inputMode="numeric" value={tx.checkNum} onChange={e => update("checkNum", e.target.value)} className={clsx("w-full pr-9 pl-4 py-2 rounded-xl border text-xs font-bold outline-none transition-all focus:ring-2 h-[38px]", T.inp, errors.checkNum && "!border-rose-500 bg-rose-50/10")} placeholder={`${nextCheque}`} />
            </div>
            {errors.checkNum && <p className="text-[9px] text-rose-500 font-black flex items-center gap-1"><AlertCircle size={10}/>{errors.checkNum}</p>}
          </div>
        )}
      </ERPSection>

      {tx.type === "deposit" && (
        <ERPSection title="جهة الإيداع والمصدر" icon={Building} colorClass="emerald" zIndex="z-[85]">
          <div className="md:col-span-2">
            <DynamicSelect label="حدد جهة الإيداع (متاحة للإضافة السريعة +)" value={tx.party} onChange={v => update("party", v)} icon={Building} defaultOptions={DEP_OPTS} />
            {errors.party && <p className="text-[9px] text-rose-500 font-black mt-1"><AlertCircle size={10} className="inline"/> {errors.party}</p>}
          </div>
        </ERPSection>
      )}

      {/* 🎯 العضو أو مسؤول الفاعلية */}
      {["advance", "aid", "activity"].includes(tx.type) && (
        <ERPSection title={tx.type === "activity" ? "مسؤول الفاعلية (الرحلة/الإفطار)" : "العضو المستفيد / مسؤول العهدة"} icon={User} colorClass="teal" zIndex="z-[80]">
          <div className="space-y-1 relative md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase pr-1">البحث في قاعدة الأعضاء</label>
            <div className="relative group">
              <Search size={14} className="absolute right-3 top-2.5 text-slate-400"/>
              <input type="text" className={clsx("w-full pr-9 pl-4 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 h-[38px]", T.inp, errors.party && "!border-rose-500")} value={searchQ} onChange={e => { setSearchQ(e.target.value); update("party", e.target.value); setShowRes(true); }} onFocus={() => setShowRes(true)} onBlur={() => setTimeout(() => setShowRes(false), 200)} placeholder="ابحث بالاسم أو الرقم الوظيفي..." />
              {showRes && searchRes.length > 0 && (
                <div className={clsx("absolute top-full mt-1 w-full border rounded-xl shadow-2xl overflow-hidden z-[200]", T.card)}>
                  {searchRes.map(emp => (
                    <button key={emp.id} type="button" onMouseDown={() => selectEmployee(emp)} className="w-full p-2.5 flex items-center justify-between hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border-b last:border-0 text-right">
                      <div><p className="text-[11px] font-black">{emp.name}</p><p className="text-[9px] text-slate-400">{emp.position || emp.jobTitle}</p></div>
                      <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{emp.jobId || "—"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tx.employeeId && <div className="flex items-center gap-1.5 text-teal-600 font-black text-[9px] mt-1 bg-teal-50 dark:bg-teal-900/30 w-fit px-2 py-0.5 rounded-lg"><UserCheck size={10}/> مرتبط بالكود: {tx.employeeId}</div>}
            {errors.party && <p className="text-[9px] text-rose-500 font-black flex items-center gap-1 mt-0.5"><AlertCircle size={10}/>{errors.party}</p>}
          </div>
        </ERPSection>
      )}

      {tx.type === "aid" && (
        <ERPSection title="موجبات صرف الإعانة" icon={Heart} colorClass="rose" zIndex="z-[75]">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase pr-1">نوع الإعانة</label>
            <select className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none h-[38px]", T.sel, errors.aidCategory && "!border-rose-500")} value={tx.aidCategory} onChange={e => { update("aidCategory", e.target.value); update("aidRel", ""); }}>
              <option value="">-- اختر نوع الإعانة --</option>
              {Object.keys(AID_RELS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase pr-1">صلة القرابة</label>
            <select className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none h-[38px]", T.sel, errors.aidRel && "!border-rose-500")} value={tx.aidRel} onChange={e => update("aidRel", e.target.value)} disabled={!tx.aidCategory}>
              <option value="">-- اختر --</option>
              {(AID_RELS[tx.aidCategory] || []).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 space-y-1 z-[60]">
            <ArabicDatePicker label="تاريخ واقعة الإعانة" value={tx.incidentDate} maxVal={tx.date} onChange={v => update("incidentDate", v)} />
          </div>
        </ERPSection>
      )}

      <ERPSection title="البيان التوضيحي والمرفقات" icon={FileText} colorClass="amber">
        <div className="md:col-span-2 space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase pr-1">{tx.type === "activity" ? "اسم الفاعلية (رحلة، مسابقة...)" : "ملاحظات وبيان السند"}</label>
          <textarea rows={2} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold resize-none outline-none focus:ring-2", T.inp)} value={tx.notes} onChange={e => update("notes", e.target.value)} placeholder="اكتب التفاصيل..." />
        </div>
        <div className="md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <FileUpload existingFiles={tx.attachments || []} onChange={files => update("attachments", files)} />
        </div>
      </ERPSection>

      <div className={clsx("flex flex-wrap justify-between items-center gap-3 p-3 border-t sticky bottom-2 z-[100] backdrop-blur-xl rounded-2xl shadow-xl border", T.card)}>
        <div className="flex gap-2 flex-1 md:flex-initial">
          <button onClick={onCancel} type="button" className={clsx("px-5 py-2.5 rounded-xl font-bold text-xs border transition-colors", T.btn)}>إلغاء للخروج</button>
          <button onClick={save} disabled={saving} className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-black text-xs transition-all shadow-md active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} {isEdit ? "تحديث السند" : "حفظ السند"}
          </button>
        </div>
      </div>
    </div>
  );
}