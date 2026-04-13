// 02) TreasuryPage.jsx
// نسخة مصححة ومثبتة لمنع أخطاء الاستيراد والتشغيل
// ✅ تعديل: عدم الانتقال للشاشة الرئيسية عند إضافة سند جديد

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useTreasuryService } from "./services/treasuryService";
import { WORKFLOW_LABELS } from "./helpers/workflow";
import TreasuryForm from "./TreasuryForm";
import {
  AlertTriangle,
  Trash2,
  Edit,
  FileText,
  X,
  Download,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Star,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import clsx from "clsx";

const TYPE_LABELS = {
  deposit: "إيداع",
  aid: "إعانة",
  advance: "سلفة",
  activity: "دعم فاعلية",
};

const TYPE_ICONS = {
  deposit: <ArrowDownRight size={14} className="text-emerald-500" />,
  aid: <ArrowUpRight size={14} className="text-sky-500" />,
  advance: <ArrowUpRight size={14} className="text-purple-500" />,
  activity: <Star size={14} className="text-amber-500" />,
};

const OPENING_BALANCE = 42685.79;

const COLOR_STYLES = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function StatCard({ label, value, icon: Icon, color, sub }) {
  const T = useT();
  return (
    <div className={clsx("flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all", T.card)}>
      <div className={clsx("p-3 rounded-xl shrink-0", COLOR_STYLES[color] || COLOR_STYLES.teal)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className={clsx("text-[10px] font-black uppercase tracking-widest", T.muted)}>{label}</p>
        <p className={clsx("text-lg font-black leading-tight", color === "emerald" ? "text-emerald-600" : color === "rose" ? "text-rose-600" : color === "amber" ? "text-amber-600" : "text-teal-600")}>
          {value}
        </p>
        {sub && <p className={clsx("text-[10px] font-bold mt-0.5", T.muted)}>{sub}</p>}
      </div>
    </div>
  );
}

export default function TreasuryPage({ userRole = "treasurer" }) {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewAttachments, setViewAttachments] = useState(null);
  const [toast, setToast] = useState(null);

  const { deleteTransaction, saveTransaction } = useTreasuryService();

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (location.search.includes("type=")) {
      setShowForm(true);
      setSelectedTx(null);
    } else if (!selectedTx) {
      setShowForm(false);
    }
  }, [location.search, selectedTx]);

  useEffect(() => {
    const qRef = query(
      collection(db, "transactions"),
      orderBy("date", "asc"),
      orderBy("checkNum", "asc")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const posted = useMemo(
    () => transactions.filter((t) => t.state === "posted" || t.state === "approved" || !t.state),
    [transactions]
  );

  const totalIn = useMemo(
    () => posted.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount || 0), 0),
    [posted]
  );

  const totalOut = useMemo(
    () => posted.filter((t) => t.type !== "deposit").reduce((s, t) => s + Number(t.amount || 0), 0),
    [posted]
  );

  const balance = OPENING_BALANCE + totalIn - totalOut;

  const openAdvances = useMemo(
    () => transactions.filter((t) => ["advance", "activity"].includes(t.type) && !t.isSettled && t.state === "posted").length,
    [transactions]
  );

  const nextCheque = useMemo(() => {
    const nums = transactions
      .map((t) => Number(t.checkNum))
      .filter((n) => Number.isFinite(n) && n > 0);
    return (nums.length ? Math.max(...nums) : 10250) + 1;
  }, [transactions]);

  const visible = useMemo(() => {
    return transactions
      .filter((t) => filterType === "all" || t.type === filterType)
      .filter((t) => filterState === "all" || (t.state || "posted") === filterState)
      .filter((t) => {
        if (!searchQ) return true;
        const q = searchQ.trim();
        return (
          t.party?.includes(q) ||
          t.notes?.includes(q) ||
          String(t.checkNum || "").includes(q)
        );
      })
      .sort((a, b) => {
        const byDate = String(a.date || "").localeCompare(String(b.date || ""));
        if (byDate !== 0) return byDate;

        const aCheck = Number(a.checkNum || Number.MAX_SAFE_INTEGER);
        const bCheck = Number(b.checkNum || Number.MAX_SAFE_INTEGER);
        return aCheck - bCheck;
      });
  }, [transactions, filterType, filterState, searchQ]);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setSelectedTx(null);
    navigate("/treasury/admin", { replace: true });
  }, [navigate]);

  // ✅ تعديل مهم: عدم إغلاق النموذج عند إضافة سند جديد
  const handleSave = async (data, isEdit) => {
    try {
      await saveTransaction(data);
      showToast(isEdit ? "تم تحديث بيانات السند بنجاح ✓" : "تم إصدار السند وترحيله بنجاح ✓");
      
      // الفرق هنا:
      if (isEdit) {
        // عند التعديل: إغلاق النموذج والعودة للقائمة
        handleCloseForm();
      } else {
        // عند الإضافة الجديدة: عدم إغلاق النموذج
        // TreasuryForm سيقوم بتفريغ المحتوى تلقائياً
        setSelectedTx(null);
        // الآن showForm سيبقى true والنموذج سيبقى مفتوح
      }

    } catch (error) {
      console.error(error);
      showToast("حدث خطأ أثناء الحفظ، يرجى المحاولة مجدداً", "error");
      throw error;
    }
  };

  const handleEdit = (tx) => {
    setSelectedTx(tx);
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTransaction(deleteTarget);
      setDeleteTarget(null);
      showToast("تم حذف السند بنجاح");
    } catch (error) {
      console.error(error);
      showToast("تعذر حذف السند", "error");
    }
  };

  if (loading) {
    return <div className="text-center p-20 text-slate-400 font-bold animate-pulse">⏳ جاري تحميل السجلات المالية...</div>;
  }

  return (
    <div className={clsx("space-y-4 max-w-7xl mx-auto pb-10 relative", T.text)} dir="rtl">
      {toast && (
        <div
          className={clsx(
            "fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 text-white font-bold",
            toast.type === "error" ? "bg-rose-600" : "bg-teal-600"
          )}
        >
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      {viewAttachments && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-md p-5 rounded-2xl shadow-2xl border relative", T.card)}>
            <button onClick={() => setViewAttachments(null)} className={clsx("absolute top-4 left-4 p-1.5 rounded-lg transition-colors", T.btn)}>
              <X size={16} />
            </button>
            <h2 className="text-sm font-black flex items-center gap-2 mb-4">
              <FileText size={16} className="text-teal-600" /> مرفقات السند ({viewAttachments.length})
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {viewAttachments.map((file, i) => (
                <div key={file.id || i} className={clsx("flex items-center justify-between p-2.5 rounded-xl border", T.sxn)}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="p-2 bg-teal-500/10 text-teal-600 rounded-lg shrink-0">
                      <FileText size={14} />
                    </span>
                    <span className="text-xs font-bold truncate">{file.name}</span>
                  </div>
                  <a href={file.url} download={file.name} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-[10px] font-bold rounded-lg hover:bg-teal-700 transition-all">
                    <Download size={12} /> تحميل
                  </a>
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
              <div className="p-2 bg-rose-100 rounded-xl"><AlertTriangle size={20} /></div>
              <div>
                <h2 className="text-base font-black">تأكيد الحذف</h2>
                <p className="text-[11px] font-bold text-slate-400 mt-1">لا يمكن التراجع عن هذا الإجراء</p>
              </div>
            </div>
            <p className="text-sm font-bold text-slate-600">
              هل تريد حذف السند الخاص بـ <span className="text-rose-600">{deleteTarget.party || "—"}</span>؟
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className={clsx("flex-1 py-2.5 rounded-xl text-xs font-black border", T.btn)}>
                إلغاء
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl text-xs font-black bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center gap-2">
                <Trash2 size={14} /> حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm ? (
        <TreasuryForm
          userRole={userRole}
          onSubmit={handleSave}
          nextCheque={nextCheque}
          initialData={selectedTx}
          onCancel={handleCloseForm}
          showToast={showToast}
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black">إدارة الخزينة والسندات</h1>
              <p className={clsx("text-xs font-bold mt-1", T.muted)}>متابعة الإيداعات والمصروفات والسلف ودعم الفعاليات</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate("/treasury/admin?type=deposit")} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 hover:bg-emerald-700">
                <Plus size={14} /> إضافة إيداع
              </button>
              <button onClick={() => navigate("/treasury/admin?type=aid")} className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-black flex items-center gap-2 hover:bg-sky-700">
                <Plus size={14} /> صرف إعانة
              </button>
              <button onClick={() => navigate("/treasury/admin?type=advance")} className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-2 hover:bg-purple-700">
                <Plus size={14} /> سلفة / عهدة
              </button>
              <button onClick={() => navigate("/treasury/admin?type=activity")} className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-black flex items-center gap-2 hover:bg-amber-700">
                <Star size={14} /> دعم فاعلية
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="إجمالي الوارد" value={`${totalIn.toLocaleString()} ج.م`} icon={TrendingUp} color="emerald" />
            <StatCard label="إجمالي المنصرف" value={`${totalOut.toLocaleString()} ج.م`} icon={TrendingDown} color="rose" />
            <StatCard label="رصيد الخزينة" value={`${balance.toLocaleString()} ج.م`} icon={Wallet} color="teal" sub={`رصيد افتتاحي ${OPENING_BALANCE.toLocaleString()} ج.م`} />
            <StatCard label="بانتظار التسوية" value={`${openAdvances}`} icon={RefreshCw} color="amber" sub="سلف وأنشطة مفتوحة" />
          </div>

          <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="بحث بالجهة أو البيان أو رقم الشيك"
                  className={clsx("w-full pr-9 pl-3 py-2.5 rounded-xl border text-xs font-bold", T.inp)}
                />
              </div>

              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={clsx("px-3 py-2.5 rounded-xl border text-xs font-bold", T.sel)}>
                <option value="all">كل الأنواع</option>
                <option value="deposit">إيداع</option>
                <option value="aid">إعانة</option>
                <option value="advance">سلفة</option>
                <option value="activity">دعم فاعلية</option>
              </select>

              <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className={clsx("px-3 py-2.5 rounded-xl border text-xs font-bold", T.sel)}>
                <option value="all">كل الحالات</option>
                <option value="posted">مرحل</option>
                <option value="draft">مسودة</option>
                <option value="approved">معتمد</option>
              </select>
            </div>
          </div>

          <div className={clsx("rounded-2xl border shadow-sm overflow-hidden", T.card)}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 text-right text-[10px] font-black text-slate-500">التاريخ</th>
                    <th className="py-3 px-4 text-right text-[10px] font-black text-slate-500">النوع</th>
                    <th className="py-3 px-4 text-right text-[10px] font-black text-slate-500">الجهة / البيان</th>
                    <th className="py-3 px-4 text-center text-[10px] font-black text-slate-500">القيمة</th>
                    <th className="py-3 px-4 text-center text-[10px] font-black text-slate-500">رقم الشيك</th>
                    <th className="py-3 px-4 text-center text-[10px] font-black text-slate-500">الحالة</th>
                    <th className="py-3 px-4 text-center text-[10px] font-black text-slate-500">المرفقات</th>
                    <th className="py-3 px-4 text-left text-[10px] font-black text-slate-500">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((tx) => (
                    <tr key={tx.id} className="group border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/30">
                      <td className="py-3 px-4 text-xs font-bold">{tx.date || "—"}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-full border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          {TYPE_ICONS[tx.type] || <Filter size={12} />}
                          {TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs font-black">{tx.party || "—"}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">{tx.notes || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-sm">
                        <span className={clsx(tx.type === "deposit" ? "text-emerald-600" : "text-rose-600")}>
                          {tx.type === "deposit" ? "+" : "−"}
                          {Number(tx.amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-[10px] font-bold text-slate-400">{tx.checkNum || "—"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={clsx("text-[9px] px-2 py-0.5 rounded-full font-black border inline-block", tx.state === "posted" ? "bg-teal-500/10 text-teal-600 border-teal-500/20" : tx.state === "draft" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20")}>
                          {WORKFLOW_LABELS[tx.state] || tx.state || "مرحل"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tx.attachments?.length > 0 ? (
                          <button onClick={() => setViewAttachments(tx.attachments)} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-all text-[10px] font-bold">
                            <FileText size={11} /> {tx.attachments.length}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(tx)} title="تعديل" className="p-1.5 text-sky-600 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 rounded-lg transition-colors">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(tx)} title="حذف" className="p-1.5 text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {visible.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 dark:bg-slate-900/30">
                    <tr>
                      <td colSpan={3} className="py-2 px-4 text-[10px] font-black text-slate-500">إجمالي المعروض ({visible.length} حركة)</td>
                      <td className="py-2 px-4 text-center font-black text-sm">
                        <span className="text-emerald-600">+{visible.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()}</span>
                        {" / "}
                        <span className="text-rose-600">−{visible.filter((t) => t.type !== "deposit").reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()}</span>
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {visible.length === 0 && (
              <div className="py-14 text-center text-slate-400 text-sm font-bold">لا توجد نتائج مطابقة للفلاتر الحالية</div>
            )}
          </div>
        </>
      )}
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> b0c71bbe4fbe59c1212fc45f3137af1efcc66927
