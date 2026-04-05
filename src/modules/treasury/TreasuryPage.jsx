import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useTreasuryService } from "./services/treasuryService";
import { WORKFLOW_LABELS } from "./helpers/workflow";
import TreasuryForm from "./TreasuryForm";
import {
  AlertTriangle, Trash2, Edit, FileText, X, Download, Plus,
  ArrowDownRight, ArrowUpRight, Filter, Search, TrendingUp,
  TrendingDown, Wallet, RefreshCw, CheckCircle2, AlertCircle, Star
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom"; 
import { useT } from "../../app/providers/ThemeProvider";
import clsx from "clsx";

// 🎯 إضافة النوع الجديد (دعم فاعلية)
const TYPE_LABELS = { deposit: "إيداع", aid: "إعانة", advance: "سلفة", activity: "دعم فاعلية" };
const TYPE_ICONS  = {
  deposit: <ArrowDownRight size={14} className="text-emerald-500" />,
  aid:     <ArrowUpRight   size={14} className="text-sky-500" />,
  advance: <ArrowUpRight   size={14} className="text-purple-500" />,
  activity:<Star           size={14} className="text-amber-500" />,
};
const OPENING_BALANCE = 42685.79;

function StatCard({ label, value, icon: Icon, color, sub }) {
  const T = useT();
  return (
    <div className={clsx("flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all", T.card)}>
      <div className={clsx("p-3 rounded-xl shrink-0", `bg-${color}-500/10`)}>
        <Icon size={20} className={`text-${color}-500`} />
      </div>
      <div className="min-w-0">
        <p className={clsx("text-[10px] font-black uppercase tracking-widest", T.muted)}>{label}</p>
        <p className={clsx("text-lg font-black leading-tight", `text-${color}-600`)}>{value}</p>
        {sub && <p className={clsx("text-[10px] font-bold mt-0.5", T.muted)}>{sub}</p>}
      </div>
    </div>
  );
}

export default function TreasuryPage({ userRole = "treasurer" }) {
  const T        = useT();
  const navigate = useNavigate(); 
  const location = useLocation();

  const [transactions,    setTransactions]    = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showForm,        setShowForm]        = useState(false);
  const [selectedTx,      setSelectedTx]      = useState(null);
  const [filterType,      setFilterType]      = useState("all");
  const [filterState,     setFilterState]     = useState("all");
  const [searchQ,         setSearchQ]         = useState("");
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [viewAttachments, setViewAttachments] = useState(null);
  const [toast, setToast] = useState(null);

  const { deleteTransaction, saveTransaction } = useTreasuryService();

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (location.search.includes("type=")) { setShowForm(true); setSelectedTx(null); } 
    else if (!selectedTx) { setShowForm(false); }
  }, [location.search, selectedTx]);

  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    return onSnapshot(q, (snap) => { setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, []);

  const posted        = useMemo(() => transactions.filter(t => t.state === "posted"), [transactions]);
  const totalIn       = useMemo(() => posted.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0), [posted]);
  const totalOut      = useMemo(() => posted.filter(t => t.type !== "deposit").reduce((s, t) => s + Number(t.amount), 0), [posted]);
  const balance       = OPENING_BALANCE + totalIn - totalOut;
  // 🎯 السلف والفاعليات بانتظار التسوية
  const openAdvances  = useMemo(() => transactions.filter(t => ["advance", "activity"].includes(t.type) && !t.isSettled && t.state === "posted").length, [transactions]);
  const nextCheque    = Math.max(0, ...transactions.filter(t => t.checkNum).map(t => Number(t.checkNum))) + 1 || 10251;

  const visible = useMemo(() => {
    return transactions.filter(t => filterType === "all" || t.type === filterType).filter(t => filterState === "all" || t.state === filterState).filter(t => {
        if (!searchQ) return true;
        return (t.party?.includes(searchQ) || t.notes?.includes(searchQ) || String(t.checkNum)?.includes(searchQ));
      });
  }, [transactions, filterType, filterState, searchQ]);

  const handleCloseForm = useCallback(() => { setShowForm(false); setSelectedTx(null); navigate("/treasury/admin", { replace: true }); }, [navigate]);

  const handleSave = async (data, isEdit) => { 
    try { await saveTransaction(data); showToast(isEdit ? "تم تحديث بيانات السند بنجاح ✓" : "تم إصدار السند وترحيله بنجاح ✓"); if (isEdit) handleCloseForm(); } 
    catch (e) { showToast("حدث خطأ أثناء الحفظ، يرجى المحاولة مجدداً", "error"); throw e; }
  };

  const handleEdit = (tx) => { setSelectedTx(tx); setShowForm(true); };
  
  const confirmDelete = async () => {
    if (!deleteTarget) return; await deleteTransaction(deleteTarget); setDeleteTarget(null); showToast("تم حذف السند بنجاح");
  };

  if (loading) return <div className="text-center p-20 text-slate-400 font-bold animate-pulse">⏳ جاري تحميل السجلات المالية...</div>;

  return (
    <div className={clsx("space-y-4 max-w-7xl mx-auto pb-10 relative", T.text)} dir="rtl">
      {toast && (
        <div className={clsx("fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 text-white font-bold", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>} <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      {viewAttachments && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-md p-5 rounded-2xl shadow-2xl border relative", T.card)}>
            <button onClick={() => setViewAttachments(null)} className={clsx("absolute top-4 left-4 p-1.5 rounded-lg transition-colors", T.btn)}><X size={16}/></button>
            <h2 className="text-sm font-black flex items-center gap-2 mb-4"><FileText size={16} className="text-teal-600"/> مرفقات السند ({viewAttachments.length})</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {viewAttachments.map((file, i) => (
                <div key={i} className={clsx("flex items-center justify-between p-2.5 rounded-xl border", T.sxn)}>
                  <div className="flex items-center gap-3 overflow-hidden"><span className="p-2 bg-teal-500/10 text-teal-600 rounded-lg shrink-0"><FileText size={14}/></span><span className="text-xs font-bold truncate">{file.name}</span></div>
                  <a href={file.url} download={file.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-[10px] font-bold rounded-lg hover:bg-teal-700 transition-all whitespace-nowrap"><Download size={12}/> تحميل</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-sm p-6 rounded-3xl shadow-2xl border space-y-5 animate-in zoom-in-95", T.card)}>
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="p-2 bg-rose-100 rounded-xl"><AlertTriangle size={20}/></div>
              <div><h2 className="text-base font-black">تأكيد الحذف</h2><p className="text-[9px] font-bold text-slate-500 uppercase">إجراء غير قابل للتراجع</p></div>
            </div>
            <p className="text-xs font-bold leading-relaxed">هل أنت متأكد من حذف هذا السند بقيمة <span className="text-rose-600 font-black">{Number(deleteTarget.amount).toLocaleString()} ج.م</span> نهائيًا وحذف كافة مرفقاته؟</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteTarget(null)} className={clsx("px-5 py-2 rounded-xl font-bold text-xs border", T.btn)}>إلغاء</button>
              <button onClick={confirmDelete} className="px-5 py-2 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-2"><Trash2 size={14}/> احذف السند</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="الرصيد الدفتري" value={balance} icon={Wallet} color={balance >= 0 ? "teal" : "rose"} sub={`يشمل ${OPENING_BALANCE.toLocaleString()} افتتاحي`} />
        <StatCard label="إجمالي الإيداعات" value={totalIn} icon={TrendingUp} color="emerald" sub={`${posted.filter(t => t.type === "deposit").length} سند مرحّل`} />
        <StatCard label="إجمالي الصرف" value={totalOut} icon={TrendingDown} color="rose" sub={`${posted.filter(t => t.type !== "deposit").length} سند مرحّل`} />
        <StatCard label="سلف وفاعليات مفتوحة" value={openAdvances} icon={RefreshCw} color="amber" sub="بانتظار التسوية" />
      </div>

      <div className={clsx("flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 rounded-2xl shadow-sm border", T.card)}>
        <div>
          <h1 className="text-xl font-black tracking-tight">إدارة شؤون الخزينة</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className={clsx("text-[10px] font-bold uppercase", T.muted)}>السندات: <span className="text-teal-600">{transactions.length}</span></p>
            <span className="w-1 h-1 rounded-full bg-slate-300"/>
            <p className={clsx("text-[10px] font-bold uppercase", T.muted)}>الشيك القادم: <span className="text-amber-600">{nextCheque}</span></p>
          </div>
        </div>

        {!showForm && (
          <div className="flex flex-wrap items-center gap-2">
            {[
              { type: "deposit", label: "إيداع", color: "emerald" }, 
              { type: "aid", label: "إعانة", color: "sky" }, 
              { type: "advance", label: "سلفة", color: "purple" },
              { type: "activity", label: "دعم فاعلية", color: "amber" } // 🎯 الزر الجديد
            ].map(({ type, label, color }) => (
              <button key={type} onClick={() => navigate(`/treasury/admin?type=${type}`)} className={clsx("px-4 py-2 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1.5 border shadow-sm", `bg-${color}-500/10 text-${color}-700 border-${color}-500/20 hover:bg-${color}-500/20`)}>
                <Plus size={12}/> {label}
              </button>
            ))}
          </div>
        )}

        {showForm && (
          <button onClick={handleCloseForm} className={clsx("px-6 py-2.5 rounded-xl font-black text-xs border shadow-sm transition-all", T.btn)}>← العودة للسجل</button>
        )}
      </div>

      {showForm ? (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <TreasuryForm key={selectedTx ? selectedTx.id : location.search} userRole={userRole} onSubmit={handleSave} initialData={selectedTx} nextCheque={nextCheque} onCancel={handleCloseForm} showToast={showToast} />
        </div>
      ) : (
        <div className={clsx("rounded-2xl shadow-sm border overflow-hidden", T.card)}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="relative">
              <Search size={13} className="absolute right-3 top-2.5 text-slate-400"/>
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="بحث بالجهة أو الشيك..." className={clsx("pr-9 pl-4 py-2 rounded-lg border text-[11px] font-bold outline-none focus:ring-2 w-48", T.inp)} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Filter size={12} className="text-slate-400"/>
                <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
                  {[["all","الكل"], ...Object.entries(TYPE_LABELS)].map(([k, v]) => (
                    <button key={k} onClick={() => setFilterType(k)} className={clsx("px-2.5 py-1 text-[10px] font-black rounded-md transition-all", filterType === k ? "bg-white dark:bg-slate-700 shadow-sm text-teal-600" : "text-slate-500")}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
                {[["all","كل الحالات"],["posted","مرحّل"],["draft","مسودة"]].map(([k,v]) => (
                  <button key={k} onClick={() => setFilterState(k)} className={clsx("px-2.5 py-1 text-[10px] font-black rounded-md transition-all", filterState === k ? "bg-white dark:bg-slate-700 shadow-sm text-teal-600" : "text-slate-500")}>{v}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                <tr>{["التاريخ","النوع","الجهة / المستفيد","المبلغ","شيك","الحالة","مرفقات","إجراءات"].map(h => <th key={h} className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {visible.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-bold text-sm">لا توجد حركات مالية مطابقة للفلتر</td></tr>}
                {visible.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3 px-4 font-bold text-slate-500 whitespace-nowrap">{tx.date}</td>
                    <td className="py-3 px-4">
                      <div className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black border", tx.type === "deposit" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : tx.type === "aid" ? "bg-sky-500/10 text-sky-700 border-sky-500/20" : tx.type === "advance" ? "bg-purple-500/10 text-purple-700 border-purple-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20")}>
                        {TYPE_ICONS[tx.type]} {TYPE_LABELS[tx.type].replace("سند ", "")}
                      </div>
                    </td>
                    <td className="py-3 px-4"><p className="font-bold text-slate-700 dark:text-slate-200 max-w-[160px] truncate">{tx.party || "—"}</p><p className="text-[10px] text-slate-400 max-w-[160px] truncate mt-0.5">{tx.notes || "بدون بيان"}</p></td>
                    <td className="py-3 px-4 text-center"><span className={clsx("font-black text-sm", tx.type === "deposit" ? "text-emerald-600" : "text-rose-600")}>{tx.type === "deposit" ? "+" : "−"}{Number(tx.amount).toLocaleString()}</span></td>
                    <td className="py-3 px-4 text-center text-[10px] font-bold text-slate-400">{tx.checkNum || "—"}</td>
                    <td className="py-3 px-4 text-center"><span className={clsx("text-[9px] px-2 py-0.5 rounded-full font-black border inline-block", tx.state === "posted" ? "bg-teal-500/10 text-teal-600 border-teal-500/20" : tx.state === "draft" ? "bg-slate-500/10 text-slate-500 border-slate-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>{WORKFLOW_LABELS[tx.state] || tx.state}</span></td>
                    <td className="py-3 px-4 text-center">{tx.attachments?.length > 0 ? <button onClick={() => setViewAttachments(tx.attachments)} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-600 text-slate-500 font-bold rounded-lg border dark:border-slate-700 text-[9px]"><FileText size={11}/> {tx.attachments.length}</button> : <span className="text-slate-300">—</span>}</td>
                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(tx)} title="تعديل" className="p-1.5 text-sky-600 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 rounded-lg transition-colors"><Edit size={14}/></button>
                        <button onClick={() => setDeleteTarget(tx)} title="حذف" className="p-1.5 text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {visible.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 dark:bg-slate-900/30">
                  <tr>
                    <td colSpan={3} className="py-2 px-4 text-[10px] font-black text-slate-500">إجمالي المعروض ({visible.length} حركة)</td>
                    <td className="py-2 px-4 text-center font-black text-sm"><span className="text-emerald-600">+{visible.filter(t => t.type === "deposit").reduce((s,t) => s + Number(t.amount),0).toLocaleString()}</span>{" / "}<span className="text-rose-600">−{visible.filter(t => t.type !== "deposit").reduce((s,t) => s + Number(t.amount),0).toLocaleString()}</span></td>
                    <td colSpan={4}/>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}