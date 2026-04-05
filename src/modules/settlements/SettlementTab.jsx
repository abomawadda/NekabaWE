/**
 * SettlementTab — شاشة تسوية السلف والفاعليات
 *
 * ✅ ميزة تسوية الفاعليات: (قيمة الشيك + اشتراكات محصلة = ميزانية الفاعلية).
 * ✅ حفظ مؤقت للفواتير.
 * ✅ بدون شاشة بيضاء بفضل الـ Local Print & Snapshot Modal.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { collection, query, onSnapshot, doc, updateDoc, where, orderBy, writeBatch } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import FileUpload from "../treasury/FileUpload"; 
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import { ReceiptText, Plus, Trash2, Printer, CheckCircle2, FileText, Tag, DollarSign, Wallet, History, Search, AlertCircle, Info, ShieldCheck, ArrowDownRight, X, Check, Users, Save, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const INITIAL_CATS = ["ضيافة وبوفيه", "أدوات مكتبية", "بدل انتقال", "صيانة", "مشتريات أخرى", "بدل جلسات"];
const BOARD_ROLES = ["رئيس المجلس", "النقيب العام", "الأمين العام", "أمين الصندوق", "عضو مجلس إدارة", "عضو مجلس"];
const getTodayISO = () => new Date().toISOString().split("T")[0];

// ── دالة الطباعة المدمجة لمنع خطأ المتصفح ──
const printSettlementLocal = ({ advanceTxn, expenses, spent, remaining, prevBalance = 0, collectedSubs = 0, returnedActually }) => {
  const win = window.open("", "_blank", "width=950,height=750");
  if (!win) return;

  const ADV_AMT = Number(advanceTxn?.advanceAmountBase || advanceTxn?.amount || 0);
  const TOTAL_AVAILABLE = ADV_AMT + Number(prevBalance) + Number(collectedSubs);

  const rowsHtml = expenses?.length > 0 
    ? expenses.map((e, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:center">${e.date}</td><td style="color:#0f766e">${e.category}</td><td>${e.notes || "—"}</td><td style="text-align:left; font-weight:900">${Number(e.amount).toLocaleString()} ج.م</td></tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">لم يتم إدراج فواتير</td></tr>`;

  win.document.write(`
    <!DOCTYPE html><html lang="ar">
    <head><meta charset="UTF-8"><title>تسوية ${advanceTxn?.type === 'activity' ? 'فاعلية' : 'عهدة'} - ${advanceTxn?.employeeName || advanceTxn?.party}</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');*{font-family:'Cairo',sans-serif;margin:0;padding:0;box-sizing:border-box;direction:rtl;}body{padding:30px;color:#1e293b;background:#fff;}.hdr{text-align:center;border-bottom:2px solid #0d9488;padding-bottom:15px;margin-bottom:20px;}.org{font-size:14px;font-weight:700;color:#64748b;margin-bottom:5px;}.doc-title{font-size:24px;font-weight:900;color:#0d9488;margin-bottom:10px;}.badge{display:inline-block;padding:5px 15px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:20px;font-size:12px;font-weight:700;color:#0f766e;}.info-row{margin-bottom:20px;padding:15px;background:#f8fafc;border-right:4px solid #0d9488;border-radius:8px;font-size:16px;font-weight:bold;}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}.stat-box{border:1px solid #e2e8f0;padding:15px;border-radius:10px;text-align:center;}.stat-label{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:5px;text-transform:uppercase;}.stat-value{font-size:20px;font-weight:900;}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}th{background:#f1f5f9;color:#0f766e;border:1px solid #cbd5e1;padding:12px;text-align:right;font-weight:900;}td{border:1px solid #cbd5e1;padding:10px;text-align:right;font-weight:700;}.footer-note{margin-top:15px;padding:10px;background:#fefce8;border:1px solid #fef08a;border-radius:8px;font-size:13px;font-weight:bold;color:#854d0e;}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:50px;text-align:center;}.sig-box{border-top:2px dashed #cbd5e1;padding-top:10px;font-size:14px;font-weight:900;color:#475569;}.sig-space{height:60px;}@media print{@page{margin:10mm;}body{padding:0;}}</style>
    </head><body>
      <div class="hdr"><div class="org">النقابة العامة للاتصالات بالدقهلية - أمانة الصندوق</div><h1 class="doc-title">كشف تسوية ${advanceTxn?.type === 'activity' ? 'فاعلية/نشاط' : 'عهدة مالية'}</h1><div class="badge">تاريخ الاعتماد: ${advanceTxn?.settlementDate || '—'}</div></div>
      <div class="info-row">اسم مسؤول التسوية: <span style="font-size:20px; color:#0d9488; margin-right: 10px;">${advanceTxn?.employeeName || advanceTxn?.party || '—'}</span></div>
      <div class="stats-grid">
        <div class="stat-box"> <div class="stat-label">قيمة الشيك المُنصرف</div> <div class="stat-value" style="color:#334155">${ADV_AMT.toLocaleString()}</div> </div>
        <div class="stat-box"> <div class="stat-label">${advanceTxn?.type === 'activity' ? 'اشتراكات محصلة نقداً' : 'رصيد مرحل من قبل'}</div> <div class="stat-value" style="color:#d97706">${advanceTxn?.type === 'activity' ? SUBS_AMT.toLocaleString() : Number(prevBalance).toLocaleString()}</div> </div>
        <div class="stat-box" style="background:#f0fdf4; border-color:#86efac"> <div class="stat-label" style="color:#15803d">إجمالي ميزانية التسوية</div> <div class="stat-value" style="color:#166534">${TOTAL_AVAILABLE.toLocaleString()}</div> </div>
        <div class="stat-box" style="background:#fff1f2; border-color:#fda4af"> <div class="stat-label" style="color:#e11d48">المنصرف الفعلي بالفواتير</div> <div class="stat-value" style="color:#be123c">${spent.toLocaleString()}</div> </div>
      </div>
      <h3 style="margin-bottom:10px; color:#334155; font-size: 14px;">بيان الفواتير والمصروفات المدرجة:</h3>
      <table><thead><tr><th style="width:40px; text-align:center;">م</th><th style="width:100px; text-align:center;">التاريخ</th><th style="width:150px;">التصنيف المحاسبي</th><th>البيان والملاحظات</th><th style="width:120px;">المبلغ</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="footer-note">الحالة النهائية للتسوية: ${remaining > 0 ? `يوجد مبلغ متبقٍ قدره (${remaining.toLocaleString()} ج.م) — ` + (returnedActually ? "تم توريده نقداً لخزينة النقابة بموجب إيصال." : "تم ترحيله كـ 'رصيد دائن' ليُخصم من السلفة القادمة.") : remaining < 0 ? `يوجد تجاوز في الصرف قدره (${Math.abs(remaining).toLocaleString()} ج.م) — يُصرف للموظف.` : `تم تسوية العهدة بالكامل (صفر).`}</div>
      <div class="sigs"><div class="sig-box">توقيع المسؤول<div class="sig-space"></div></div><div class="sig-box">المراجعة والرقابة<div class="sig-space"></div></div><div class="sig-box">يعتمد، أمين الصندوق<div class="sig-space"></div></div></div>
      <script>window.onload=()=>{setTimeout(()=>window.print(), 500);}</script>
    </body></html>
  `);
  win.document.close();
};

function FinanceCard({ label, value, color, icon: Icon, isTotal }) {
  const safeValue = Number(value || 0).toLocaleString();
  return (
    <div className={clsx("p-3 rounded-xl border flex flex-col justify-center transition-all", isTotal ? `bg-${color}-600 text-white border-${color}-700 shadow-md` : `bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800`)}>
      <div className="flex items-center gap-1.5 mb-1 opacity-90">{Icon && <Icon size={12} />}<p className="text-[9px] font-black uppercase tracking-widest">{label}</p></div>
      <p className={clsx("text-lg font-black", !isTotal && `text-${color}-700 dark:text-${color}-400`)}>{safeValue} <span className="text-[9px] font-bold">ج.م</span></p>
    </div>
  );
}

function InlineDynamicSelect({ label, value, onChange, icon: Icon, defaultOptions = [] }) {
  const T = useT();
  const [options, setOptions] = useState(defaultOptions);
  const [isAdding, setIsAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  useEffect(() => { if (value && !options.includes(value)) setOptions(prev => [...prev, value]); }, [value, options]);
  const handleAdd = () => { const trimmed = newVal.trim(); if (trimmed && !options.includes(trimmed)) { setOptions(prev => [...prev, trimmed]); onChange(trimmed); } setIsAdding(false); setNewVal(""); };
  return (
    <div className="space-y-1 relative w-full" dir="rtl">
      {label && <label className="text-[10px] font-black text-slate-500 uppercase pr-1">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative group flex-1">
          {Icon && <Icon size={14} className="absolute right-3 top-2.5 text-slate-400 z-10 pointer-events-none"/>}
          <select value={value} onChange={e => onChange(e.target.value)} className={clsx("w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-teal-500 transition-all h-[38px] appearance-none", Icon ? "pr-9" : "pr-3", T.sel)}>
            <option value="">-- اختر التصنيف --</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => setIsAdding(!isAdding)} className="w-10 h-[38px] flex items-center justify-center bg-teal-50 text-teal-600 dark:bg-teal-900/30 rounded-xl hover:bg-teal-500 hover:text-white transition-colors shadow-sm shrink-0"><Plus size={16} /></button>
      </div>
      {isAdding && (
        <div className={clsx("absolute top-full right-0 w-full mt-1 p-2 rounded-xl shadow-xl border flex items-center gap-2 z-[200] animate-in fade-in zoom-in-95", T.card)}>
          <input autoFocus type="text" value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="اسم البند الجديد..." className={clsx("flex-1 px-3 py-1.5 text-xs font-bold rounded-lg border outline-none", T.inp)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button type="button" onClick={handleAdd} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm"><Check size={14}/></button>
          <button type="button" onClick={() => setIsAdding(false)} className="p-2 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded-lg hover:bg-rose-500 hover:text-white"><X size={14}/></button>
        </div>
      )}
    </div>
  );
}

export default function SettlementTab() {
  const T = useT();
  const [activeTab,     setActiveTab]     = useState("current");
  const [transactions,  setTransactions]  = useState([]);
  const [employees,     setEmployees]     = useState([]);
  const [boardMeetings, setBoardMeetings] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  
  const [selAdvId,      setSelAdvId]      = useState("");
  const [settlementDate,setSettlementDate]= useState(getTodayISO());
  const [expenses,      setExpenses]      = useState([]);
  const [returnedActually, setReturnedActually] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  
  // 🎯 الميزانية الإضافية للفاعليات (الاشتراكات المحصلة)
  const [collectedSubs, setCollectedSubs] = useState("");
  
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [expenseToDelete,  setExpenseToDelete]  = useState(null); 
  
  const [expAmt,        setExpAmt]        = useState("");
  const [expCat,        setExpCat]        = useState(INITIAL_CATS[0]);
  const [expNotes,      setExpNotes]      = useState("");
  const [expDate,       setExpDate]       = useState(getTodayISO());
  const [expFiles,      setExpFiles]      = useState([]);
  const [expMeetingId,  setExpMeetingId]  = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    const qTrans = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTrans = onSnapshot(qTrans, snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qEmps = query(collection(db, "employees"));
    const unsubEmps = onSnapshot(qEmps, snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qMeet = query(collection(db, "board_meetings"), where("status", "==", "held"));
    const unsubMeet = onSnapshot(qMeet, snap => {
      setBoardMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubTrans(); unsubEmps(); unsubMeet(); };
  }, []);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const activeBoardMembers = useMemo(() => employees.filter(e => BOARD_ROLES.includes(e.membershipStatus) && !["وفاة", "استقالة"].includes(e.memberState)), [employees]);

  useEffect(() => {
    if (expCat === "بدل انتقال") setSelectedMembers(activeBoardMembers.map(m => m.id));
    else setSelectedMembers([]);
    if (expCat !== "بدل جلسات") setExpMeetingId("");
  }, [expCat, activeBoardMembers]);

  const archivedSettlements = useMemo(() => transactions.filter(t => ["advance", "activity"].includes(t.type) && t.isSettled), [transactions]);
  
  const getPrevBalance = (empId, currentTxnId) => {
    if (!empId) return 0;
    const history = archivedSettlements.filter(s => s.employeeId === empId && s.id !== currentTxnId).sort((a, b) => (b.settlementDate || "").localeCompare(a.settlementDate || ""));
    return (history.length > 0 && !history[0].returnedActually) ? Number(history[0].settlementReturned || 0) : 0;
  };

  const openAdvances = useMemo(() => transactions.filter(t => ["advance", "activity"].includes(t.type) && !t.isSettled && t.state === "posted").map(adv => ({ ...adv, prevBalance: getPrevBalance(adv.employeeId, adv.id) })), [transactions, archivedSettlements]);

  const selectedTxn = useMemo(() => openAdvances.find(a => a.id === selAdvId) || null, [openAdvances, selAdvId]);

  // 🎯 حسابات الفاعلية والسلفة (أصل + اشتراكات أو مرحل)
  const ADVANCE_AMT    = Number(selectedTxn?.amount || 0);
  const PREV_BALANCE   = selectedTxn?.type === "activity" ? 0 : Number(selectedTxn?.prevBalance || 0);
  const SUBS_AMT       = selectedTxn?.type === "activity" ? Number(collectedSubs || 0) : 0;
  const TOTAL_AVAILABLE= ADVANCE_AMT + PREV_BALANCE + SUBS_AMT;
  
  const spent          = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const remaining      = TOTAL_AVAILABLE - spent;

  useEffect(() => {
    if (selectedTxn) {
      setExpenses(selectedTxn.settlementExpenses || []);
      setCollectedSubs(selectedTxn.collectedSubscriptions || ""); // استدعاء الاشتراكات إن وجدت
      setReturnedActually(false);
      setExpAmt(""); setExpNotes(""); setExpFiles([]); setSelectedMembers([]);
    } else {
      setExpenses([]); setCollectedSubs("");
    }
  }, [selectedTxn]);

  const addExpense = () => {
    if (!expAmt || Number(expAmt) <= 0) return showToast("أدخل مبلغاً صحيحاً", "error");
    if (Number(expAmt) > remaining) return showToast(`تجاوزت المتاح! (${Number(remaining || 0).toLocaleString()} ج.م)`, "error");
    if (expCat === "بدل جلسات" && !expMeetingId) return showToast("يرجى اختيار الاجتماع المرتبط", "error");
    if (expCat === "بدل انتقال" && selectedMembers.length === 0) return showToast("اختر عضو مجلس واحد على الأقل", "error");

    setExpenses(prev => [...prev, { id: `e_${Date.now()}`, date: expDate, amount: expAmt, category: expCat, notes: expNotes, meetingId: expMeetingId, boardMembers: expCat === "بدل انتقال" ? selectedMembers : [], files: expFiles }]);
    setExpAmt(""); setExpNotes(""); setExpFiles([]); setExpMeetingId(""); setSelectedMembers([]);
    showToast("تم إدراج الفاتورة في الكشف", "success");
  };

  const executeRemoveExpense = () => {
    if (!expenseToDelete) return;
    setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
    setExpenseToDelete(null);
    showToast("تم حذف الفاتورة", "success");
  };

  // 🎯 ميزة الحفظ المؤقت للرجوع لها لاحقاً
  const handleSaveDraft = async () => {
    if (!selectedTxn) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "transactions", selectedTxn.id), {
        settlementExpenses: expenses,
        collectedSubscriptions: SUBS_AMT,
        updatedAt: new Date().toISOString()
      });
      showToast("تم حفظ الفواتير في العهدة بنجاح (يمكنك إغلاقها لاحقاً) ✓", "success");
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء الحفظ المؤقت", "error");
    } finally { setSaving(false); }
  };

  const openConfirmModal = () => {
    setConfirmModalData({
      txnId: selectedTxn.id,
      party: selectedTxn.party,
      totalAvailable: TOTAL_AVAILABLE,
      spent: spent,
      remaining: remaining,
      prevBalance: PREV_BALANCE,
      advanceAmountBase: ADVANCE_AMT,
      collectedSubs: SUBS_AMT,
      type: selectedTxn.type
    });
  };

  const handleFinalSettle = async () => {
    if (!confirmModalData) return;
    
    setSaving(true);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, "transactions", confirmModalData.txnId), {
        isSettled: true,
        settlementDate,
        settlementExpenses: expenses,
        settlementSpent: confirmModalData.spent,
        settlementReturned: returnedActually ? 0 : confirmModalData.remaining,
        returnedActually,
        prevBalanceUsed: confirmModalData.prevBalance,
        advanceAmountBase: confirmModalData.advanceAmountBase,
        collectedSubscriptions: confirmModalData.collectedSubs,
        employeeName: confirmModalData.party,
        updatedAt: new Date().toISOString(),
      });

      expenses.forEach(line => {
        if (line.category === "بدل جلسات" && line.meetingId) {
          const meeting = boardMeetings.find(m => m.id === line.meetingId);
          if (meeting && meeting.attendees?.length > 0) {
            batch.update(doc(db, "board_meetings", meeting.id), {
              allowancePerMember: Number(line.amount) / meeting.attendees.length,
              totalAllowancePaid: Number(line.amount),
              allowanceTypePaid: line.category
            });
          }
        } else if (line.category === "بدل انتقال" && line.boardMembers?.length > 0) {
          const newMeetingRef = doc(collection(db, "board_meetings"));
          batch.set(newMeetingRef, {
             title: `بدل انتقال - تسوية (${confirmModalData.party})`,
             date: line.date || getTodayISO(),
             status: "held",
             attendees: line.boardMembers,
             allowancePerMember: Number(line.amount) / line.boardMembers.length,
             totalAllowancePaid: Number(line.amount),
             allowanceTypePaid: line.category,
             isAllowanceOnly: true
          });
        }
      });

      await batch.commit();

      showToast("تم إغلاق العهدة وتحديث البدلات بنجاح ✓", "success");
      
      setConfirmModalData(null);
      setTimeout(() => { setSelAdvId(""); setActiveTab("archive"); }, 100);

    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء الاعتماد", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400">جاري تحميل البيانات...</div>;

  return (
    <div className={clsx("flex flex-col gap-4 max-w-7xl mx-auto pb-10", T.text)} dir="rtl">
      
      {toast && (
        <div className={clsx("fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-white font-bold animate-in fade-in slide-in-from-top-4", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
          <span className="text-xs">{toast.msg}</span>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-sm p-6 rounded-3xl shadow-2xl border space-y-5 animate-in zoom-in-95", T.card)}>
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl"><AlertTriangle size={20}/></div>
              <div><h2 className="font-black text-sm">حذف بند مصروف</h2><p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">إجراء غير قابل للتراجع</p></div>
            </div>
            <p className="text-xs font-bold leading-relaxed">
              هل أنت متأكد من حذف فاتورة <span className="font-black text-teal-600">({expenseToDelete.category})</span> بقيمة <span className="font-black text-rose-600">{Number(expenseToDelete.amount || 0).toLocaleString()} ج.م</span> من كشف التسوية؟
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setExpenseToDelete(null)} className={clsx("flex-1 py-2.5 rounded-xl font-bold text-xs border shadow-sm", T.btn)}>إلغاء</button>
              <button onClick={executeRemoveExpense} className="flex-1 py-2.5 rounded-xl font-black text-xs bg-rose-600 text-white hover:bg-rose-700 shadow-md active:scale-95 flex items-center justify-center gap-2">
                <Trash2 size={14}/> تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModalData && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-md p-5 rounded-2xl shadow-2xl border space-y-5 animate-in zoom-in-95", T.card)}>
            <div className="flex items-center gap-3 text-teal-600 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-teal-100 dark:bg-teal-900/30 rounded-xl"><ShieldCheck size={20}/></div>
              <div><h2 className="font-black text-sm">تأكيد إغلاق العهدة نهائياً</h2><p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">التاريخ: {settlementDate}</p></div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"><p className="text-[9px] font-black text-slate-400 mb-1">المتاح الكلي</p><p className="text-xs font-black text-slate-700 dark:text-slate-300">{Number(confirmModalData.totalAvailable || 0).toLocaleString()}</p></div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800"><p className="text-[9px] font-black text-rose-400 mb-1">المصروف الفعلي</p><p className="text-xs font-black text-rose-600">{Number(confirmModalData.spent || 0).toLocaleString()}</p></div>
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800"><p className="text-[9px] font-black text-teal-500 mb-1">المتبقي النهائي</p><p className="text-xs font-black text-teal-600">{Number(confirmModalData.remaining || 0).toLocaleString()}</p></div>
            </div>

            {confirmModalData.remaining > 0 && (
              <label className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 cursor-pointer hover:bg-amber-100 transition-colors">
                <input type="checkbox" checked={returnedActually} onChange={e => setReturnedActually(e.target.checked)} className="w-4 h-4 mt-0.5 accent-amber-600"/>
                <div>
                  <span className="text-amber-900 dark:text-amber-400 text-xs font-black block">تم توريد المتبقي ({Number(confirmModalData.remaining || 0).toLocaleString()} ج) نقدًا</span>
                  <span className="block text-[9px] font-bold text-amber-600 mt-1 leading-relaxed">عدم التفعيل يعني ترحيل المبلغ "كرصيد دائن" للسلفة القادمة.</span>
                </div>
              </label>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setConfirmModalData(null)} className={clsx("flex-1 py-2.5 rounded-xl font-bold text-xs border shadow-sm", T.btn)}>رجوع</button>
              <button onClick={handleFinalSettle} disabled={saving} className="flex-[2] py-2.5 rounded-xl font-black text-xs bg-teal-600 text-white hover:bg-teal-700 flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} اعتماد نهائي وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* التبويبات العلوية */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-fit shadow-inner">
        <button onClick={() => setActiveTab("current")} className={clsx("px-6 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2", activeTab === "current" ? "bg-white dark:bg-slate-700 shadow-md text-teal-600" : "text-slate-500 hover:text-slate-700")}>
          <ReceiptText size={14}/> تسوية عهدة أو نشاط {openAdvances.length > 0 && <span className="bg-amber-500 text-white text-[9px] rounded-full px-1.5 py-0.5 shadow-sm">{openAdvances.length}</span>}
        </button>
        <button onClick={() => setActiveTab("archive")} className={clsx("px-6 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2", activeTab === "archive" ? "bg-white dark:bg-slate-700 shadow-md text-teal-600" : "text-slate-500 hover:text-slate-700")}>
          <History size={14}/> أرشيف التقارير
        </button>
      </div>

      {/* ═══════════════════════ التبويب الجاري ═══════════════════════ */}
      {activeTab === "current" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-in fade-in duration-500">

          {/* ── 1. رأس العهدة (المبالغ) ── */}
          <div className="lg:col-span-12">
            <div className={clsx("p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white dark:bg-slate-900", T.card)}>
              <div className="w-full md:w-2/5 space-y-1.5 relative z-[100]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">اختر السلفة أو الفاعلية</label>
                <select value={selAdvId} onChange={e => setSelAdvId(e.target.value)} className={clsx("w-full px-3 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-teal-500 h-[42px]", T.sel)}>
                  <option value="">— السلف والأنشطة المفتوحة —</option>
                  {openAdvances.map(a => <option key={a.id} value={a.id}>{a.party} {a.type === 'activity' ? '(دعم نشاط)' : ''} — {Number(a.amount).toLocaleString()} ج</option>)}
                </select>

                {/* 🎯 إذا كان دعم نشاط، يمكنه إدخال الاشتراكات المحصلة */}
                {selectedTxn?.type === "activity" && (
                  <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-1.5 animate-in fade-in">
                    <label className="text-[9px] font-black text-indigo-700 uppercase">الاشتراكات المحصلة نقداً (خارج الشيك)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute right-3 top-2.5 text-indigo-400"/>
                      <input type="number" value={collectedSubs} onChange={e => setCollectedSubs(e.target.value)} placeholder="مثال: 5000" className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:border-indigo-400 h-[38px] bg-white", T.inp)}/>
                    </div>
                  </div>
                )}
              </div>

              {selectedTxn && (
                <div className={clsx("flex-1 w-full grid gap-2", selectedTxn.type === "activity" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
                  <FinanceCard label={selectedTxn.type === "activity" ? "شيك الدعم" : "أصل السلفة"} value={ADVANCE_AMT} color="slate" icon={ArrowDownRight}/>
                  
                  {selectedTxn.type === "activity" ? (
                    <FinanceCard label="اشتراكات محصلة" value={SUBS_AMT} color="indigo" icon={Plus}/>
                  ) : (
                    <FinanceCard label="رصيد مرحل" value={PREV_BALANCE} color="amber" icon={History}/>
                  )}

                  {/* 🎯 المتبقي الديناميكي */}
                  <FinanceCard label="إجمالي الميزانية" value={TOTAL_AVAILABLE} color="teal" icon={Wallet} isTotal/>
                  <FinanceCard label="المتبقي للرد" value={remaining} color={remaining >= 0 ? "emerald" : "rose"} icon={ReceiptText}/>
                </div>
              )}
            </div>
          </div>

          {/* ── 2. إدراج الفواتير ── */}
          <div className={clsx("lg:col-span-4 p-4 rounded-2xl border shadow-sm space-y-4 h-fit", T.card, !selectedTxn && "opacity-50 pointer-events-none")}>
            <h3 className="font-black text-xs flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 text-amber-600">
              <Plus size={14}/> إدراج فاتورة جديدة
            </h3>
            
            <div className="space-y-3">
              <InlineDynamicSelect label="تصنيف المصروف (+ جديد)" defaultOptions={INITIAL_CATS} value={expCat} onChange={setExpCat} icon={Tag} />
              
              {expCat === "بدل جلسات" && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-1.5 animate-in fade-in">
                  <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5"><ShieldCheck size={14}/> ربط باجتماع المجلس</label>
                  <select value={expMeetingId} onChange={e => setExpMeetingId(e.target.value)} className={clsx("w-full px-2 py-2 rounded-lg border text-[10px] font-bold outline-none", T.sel)}>
                    <option value="">-- اختر الاجتماع المُعتمد --</option>
                    {boardMeetings.map(m => <option key={m.id} value={m.id}>{m.title} ({m.date}) - الحضور: {m.attendees?.length || 0}</option>)}
                  </select>
                  {expMeetingId && expAmt && <p className="text-[8px] font-black text-indigo-600 mt-1 flex gap-1"><Info size={10} className="shrink-0"/> سيُقسَم ({expAmt} ج) ويُدرج بملف بدلات الحاضرين.</p>}
                </div>
              )}

              {expCat === "بدل انتقال" && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5"><Users size={14}/> تحديد أعضاء المجلس المستحقين</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-800">
                    {activeBoardMembers.map(m => (
                      <label key={m.id} className="flex items-center gap-2 text-[10px] font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedMembers.includes(m.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMembers(p => [...p, m.id]);
                            else setSelectedMembers(p => p.filter(id => id !== m.id));
                          }}
                          className="accent-indigo-600"
                        />
                        {m.name.split(" ").slice(0,2).join(" ")}
                      </label>
                    ))}
                    {activeBoardMembers.length === 0 && <p className="text-[9px] text-slate-400 p-1">لا يوجد أعضاء مجلس نشطين</p>}
                  </div>
                  {expAmt && selectedMembers.length > 0 && (
                    <p className="text-[9px] font-black text-indigo-600 mt-1 flex gap-1 bg-indigo-100/50 dark:bg-indigo-900/50 p-1.5 rounded">
                      <Info size={10} className="shrink-0"/> نصيب العضو: {(Number(expAmt) / selectedMembers.length).toFixed(2)} ج.م
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase pr-1">المبلغ (ج.م)</label>
                  <input type="number" value={expAmt} onChange={e => setExpAmt(e.target.value)} placeholder={`المتاح: ${remaining}`} className={clsx("w-full px-3 py-2.5 rounded-xl border text-xs font-black outline-none focus:ring-2 focus:border-amber-500 h-[38px]", T.inp, Number(expAmt) > remaining && "!border-rose-500 bg-rose-50/10")} />
                </div>
                <div className="space-y-1 relative z-[90]">
                  <ArabicDatePicker label="تاريخ الفاتورة" value={expDate} onChange={setExpDate} maxVal={getTodayISO()} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase pr-1">بيان وملاحظات</label>
                <input type="text" value={expNotes} onChange={e => setExpNotes(e.target.value)} placeholder="مثال: فاتورة صيانة..." className={clsx("w-full px-3 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-amber-500 h-[38px]", T.inp)} />
              </div>

              <FileUpload txId={`tmp_${selAdvId}`} existingFiles={expFiles} onChange={setExpFiles}/>

              <button onClick={addExpense} disabled={!expAmt || Number(expAmt) <= 0 || Number(expAmt) > remaining} className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40">
                <Plus size={14}/> إدراج للكشف
              </button>
            </div>
          </div>

          {/* ─── 3. كشف الفواتير ─── */}
          <div className={clsx("lg:col-span-8 p-4 rounded-2xl border shadow-sm flex flex-col", T.card, !selectedTxn && "opacity-50 pointer-events-none")}>
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
              <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-2"><ReceiptText size={16} className="text-teal-600"/> الفواتير المدرجة ({expenses.length})</h3>
              <div className="flex items-center gap-3">
                <div className="z-[100] w-32"><ArabicDatePicker value={settlementDate} onChange={setSettlementDate} maxVal={getTodayISO()} /></div>
                <div className="text-left bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-800 text-rose-600">
                  <p className="text-[8px] font-black uppercase tracking-widest">إجمالي المنصرف</p>
                  <p className="text-lg font-black leading-none mt-0.5">{Number(spent || 0).toLocaleString()} <span className="text-[9px]">ج.م</span></p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto min-h-[250px]">
              <table className="w-full text-right text-[11px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b">
                  <tr>{["التصنيف","البيان والتاريخ","المبلغ","إجراء"].map((h, i) => <th key={i} className="p-2.5 text-slate-400 font-black">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={4} className="p-16 text-center text-slate-400 font-bold text-xs border-2 border-dashed rounded-xl mt-4">الكشف فارغ — قم بإضافة فواتير</td></tr>
                  ) : expenses.map((e, i) => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-2.5 font-black text-teal-600">
                        {e.category}
                        {e.meetingId && <span className="block text-[8px] text-indigo-500 mt-0.5 font-bold">ارتباط بمجلس</span>}
                        {e.boardMembers?.length > 0 && <span className="block text-[8px] text-indigo-500 mt-0.5 font-bold">بمشاركة {e.boardMembers.length} أعضاء</span>}
                      </td>
                      <td className="p-2.5">
                        <p className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{e.notes || "—"}</p>
                        <p className="text-[9px] font-black text-slate-400 mt-0.5">{e.date}</p>
                      </td>
                      <td className="p-2.5 font-black text-rose-600 text-sm">{Number(e.amount || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-left"><button onClick={() => setExpenseToDelete(e)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="حذف الفاتورة"><Trash2 size={14}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-xl">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-400 uppercase">موقف الميزانية:</p>
                <p className={clsx("text-base font-black", remaining >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {remaining >= 0 ? `متبقي للرد: ${remaining.toLocaleString()} ج` : `تجاوز للصرف: ${Math.abs(remaining).toLocaleString()} ج`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveDraft} disabled={saving || expenses.length === 0} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 border shadow-sm active:scale-95 disabled:opacity-40">
                  <Save size={14}/> حفظ مؤقت
                </button>
                <button onClick={openConfirmModal} disabled={expenses.length === 0} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCircle2 size={16}/> اعتماد نهائي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ تبويب الأرشيف ═══════════════════════ */}
      {activeTab === "archive" && (
        <div className={clsx("rounded-2xl border shadow-sm overflow-hidden animate-in fade-in duration-500", T.card)}>
          <div className="p-4 border-b flex flex-wrap justify-between items-center gap-3 bg-slate-50/50 dark:bg-slate-900/20">
            <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-2"><History size={14} className="text-teal-600"/> أرشيف وتسويات العهد والأنشطة</h3>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-2.5 text-slate-400"/>
              <input type="text" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} placeholder="بحث بالمسؤول..." className={clsx("pr-9 pl-4 py-2 rounded-xl border text-[11px] font-bold outline-none focus:ring-2 w-56", T.inp)} />
            </div>
          </div>
          
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-700">
                <tr>{["الاعتماد","المسؤول (النوع)","التمويل","متاح","منصرف","الرصيد المرحل",""].map((h, i) => <th key={i} className="p-3 font-black text-slate-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {archivedSettlements.filter(s => !archiveSearch || s.employeeName?.includes(archiveSearch) || s.party?.includes(archiveSearch)).map(s => {
                  const sAdvance = Number(s.advanceAmountBase || s.amount || 0);
                  const sPrevBal = Number(s.prevBalanceUsed || 0);
                  const sSubs    = Number(s.collectedSubscriptions || 0);
                  const sAvailable = sAdvance + sPrevBal + sSubs;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-bold text-slate-500 whitespace-nowrap">{s.settlementDate}</td>
                      <td className="p-3 font-black text-slate-800 dark:text-slate-100">
                        {s.employeeName || s.party}
                        <span className="block text-[8px] text-slate-400 mt-0.5">{s.type === "activity" ? "نشاط / فاعلية" : "سلفة عادية"}</span>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-600">شيك: {sAdvance.toLocaleString()}</p>
                        {s.type === "activity" && sSubs > 0 && <p className="font-bold text-indigo-500 text-[9px]">اشتراكات: {sSubs.toLocaleString()}</p>}
                        {s.type !== "activity" && sPrevBal > 0 && <p className="font-bold text-amber-600 text-[9px]">مرحل: {sPrevBal.toLocaleString()}</p>}
                      </td>
                      <td className="p-3 font-black text-teal-600 bg-teal-50/50 dark:bg-transparent rounded-lg">{sAvailable.toLocaleString()}</td>
                      <td className="p-3 font-black text-rose-600">{Number(s.settlementSpent || 0).toLocaleString()}</td>
                      <td className="p-3 font-black">
                        <span className={clsx(s.returnedActually ? "text-slate-400 line-through opacity-70" : "text-emerald-600")}>{Number(s.settlementReturned || 0).toLocaleString()}</span>
                        <span className="block text-[8px] mt-0.5 text-slate-400 font-bold">{s.returnedActually ? "تم الرد نقدًا" : "مرحّل للقادم"}</span>
                      </td>
                      <td className="p-3 text-left">
                        <button onClick={() => printSettlementLocal({ advanceTxn: s, expenses: s.settlementExpenses, spent: s.settlementSpent, remaining: s.settlementReturned, prevBalance: sPrevBal, collectedSubs: sSubs, returnedActually: s.returnedActually })} className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors" title="طباعة"><Printer size={16}/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}