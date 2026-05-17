import React, { useEffect, useState, useMemo, Suspense, startTransition } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useTreasuryService } from "./services/treasuryService";
import {
  DIRECT_FINANCE_TYPES,
  getIssuedCheckTypeLabel,
  mergeIssuedChecksSourcesNormalized,
  normalizeIssuedCheckType,
  normalizeRequiresSettlement,
} from "./helpers/issuedChecks";

const TreasuryForm = React.lazy(() => import("./TreasuryForm"));

import {
  AlertTriangle,
  Trash2,
  FileText,
  X,
  Plus,
  FilterX,
  Printer,
  TableProperties,
  ArrowUpRight,
  ShieldCheck,
  Star,
  Building2,
  Wallet
} from "lucide-react";

import { useNavigate, useLocation } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { useAlert } from "../../app/providers/AlertProvider";
import { filterDataByScope, PERMISSIONS } from "../../security/permissions";
import ErrorBoundary from "../../ui/ErrorBoundary";
import TreasuryStatsBar from "./TreasuryStatsBar";
import TreasuryFilters from "./TreasuryFilters";
import TreasuryTable from "./TreasuryTable";
import { openPrintWindow } from "../../utils/print";
import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import { formatMoney } from "../../utils/numberFormat";
import { downloadAs } from "../../utils/downloadData";

const PAGE_SIZE = 50;

export default function TreasuryPage() {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, can } = useAuth();
  const { showToast } = useAlert();

  const [issuedChecks, setIssuedChecks] = useState([]);
  const [legacyTransactions, setLegacyTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  const [filterType, setFilterType] = useState("all");
  const [filterState, setFilterState] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("filter") === "draft" ? "draft" : "all";
  });
  const [searchQ, setSearchQ] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [_viewAttachments, setViewAttachments] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(null);

  const { deleteTransaction, saveTransaction } = useTreasuryService();

  const canCreateFinancial = can(PERMISSIONS.treasuryCreate);
  const canEditFinancial = can(PERMISSIONS.treasuryEdit);
  const canDeleteFinancial = can(PERMISSIONS.treasuryDelete);
  const canPost = can(PERMISSIONS.treasuryPost);
  const canViewAttachments = can(PERMISSIONS.attachmentsView);

  // فتح النموذج عند وجود type في الرابط (sidebar, dashboard links)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const typeParam = params.get("type");

    if (typeParam && canCreateFinancial) {
      const normalized = normalizeIssuedCheckType(typeParam);
      if (normalized) {
        startTransition(() => {
          setSelectedTx(null);
          setShowForm(true);
        });
      }
    }
  }, [location.search, canCreateFinancial]);

  useEffect(() => {
    let checksReady = false;
    let legacyReady = false;
    const finishLoading = () => { if (checksReady && legacyReady) setLoading(false); };

    const unsubChecks = onSnapshot(
      query(collection(db, "issued_checks"), orderBy("date", "desc")),
      (snap) => {
        setIssuedChecks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        checksReady = true; finishLoading();
      },
      (err) => { setError(err.message); setLoading(false); }
    );

    const unsubLegacy = onSnapshot(
      query(collection(db, "transactions"), orderBy("date", "desc")),
      (snap) => {
        setLegacyTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        legacyReady = true; finishLoading();
      },
      (err) => { setError(err.message); setLoading(false); }
    );

    return () => { unsubChecks(); unsubLegacy(); };
  }, []);

  const allTransactions = useMemo(() => {
    const directEntries = legacyTransactions
      .filter(tx => DIRECT_FINANCE_TYPES.includes(tx.type) || tx.type === "deposit")
      .map(tx => ({ ...tx, sourceCollection: "transactions" }));

    const normalizedChecks = mergeIssuedChecksSourcesNormalized(issuedChecks, legacyTransactions);
    return [...normalizedChecks, ...directEntries];
  }, [issuedChecks, legacyTransactions]);

  const visible = useMemo(() => {
    const queryText = searchQ.trim().toLowerCase();
    const scoped = filterDataByScope(allTransactions, "treasury", user);

    return scoped
      .filter(t => filterType === "all" || t.type === filterType)
      .filter(t => filterState === "all" || (t.state || "posted") === filterState)
      .filter(t => {
        if (!queryText) return true;
        const searchContent = [
          t.party, t.beneficiaryName, t.checkNum, t.notes, getIssuedCheckTypeLabel(t.type) || (t.type === "deposit" ? "إيداع" : "")
        ].join(" ").toLowerCase();
        return searchContent.includes(queryText);
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [allTransactions, filterType, filterState, searchQ, user]);

  const paginatedVisible = useMemo(() => showAll ? visible : visible.slice(0, PAGE_SIZE), [visible, showAll]);

  const nextCheque = useMemo(() => {
    const nums = allTransactions.map((t) => Number(t.checkNum)).filter((n) => Number.isFinite(n) && n > 0);
    return (nums.length ? Math.max(...nums) : 10250) + 1;
  }, [allTransactions]);

  const resetFilters = () => {
    setFilterType("all"); setFilterState("all"); setSearchQ("");
  };

  const openFormForType = (type) => {
    navigate(`/treasury/admin?type=${type}`, { replace: true });
    setSelectedTx(null);
    setShowForm(true);
  };

  const handleExportExcel = async (format) => {
    showToast("جاري التجهيز...", "success");
    try {
      const rows = visible.map(tx => ({
        التاريخ: tx.date || "—",
        "رقم المستند": tx.checkNum || tx.bankReference || "—",
        المستفيد: tx.party || tx.beneficiaryName || "—",
        النوع: tx.type === "deposit" ? "إيداع بنكي" : getIssuedCheckTypeLabel(tx.type) || tx.type,
        البيان: tx.notes || "",
        المبلغ: Number(tx.amount || 0),
        "حالة التسوية": tx.type === "deposit" ? "مكتمل" : (tx.requires_settlement || tx.requiresSettlement ? (tx.isSettled ? "مسوى" : "معلق") : "لا يتطلب"),
      }));
      await downloadAs(format, rows, `سجلات_الخزينة_${new Date().toISOString().split('T')[0]}`);
    } catch {
      showToast("حدث خطأ أثناء التصدير", "error");
    }
  };

  // 🔴 تقرير محاسبي حقيقي (مدين/دائن/رصيد)
  const handlePrintReport = () => {
    const win = openPrintWindow("treasury-report", "width=1100,height=800");
    if (!win) return;

    // ترتيب تصاعدي لكشف الحساب
    const chronologicalTx = [...visible].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let runningBalance = 0; // الرصيد الافتتاحي (بناء على الفلتر الحالي يعتبر صفر)
    let totalDebit = 0;
    let totalCredit = 0;

    const rowsHtml = chronologicalTx.map((tx, i) => {
      const isDeposit = tx.type === "deposit";
      const debit = isDeposit ? 0 : Number(tx.amount || 0); // منصرف (مدين)
      const credit = isDeposit ? Number(tx.amount || 0) : 0; // وارد (دائن)

      totalDebit += debit;
      totalCredit += credit;
      runningBalance += (credit - debit); // الرصيد المتراكم

      return `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td style="text-align:center; white-space:nowrap;">${tx.date || "—"}</td>
          <td style="text-align:center;">${tx.checkNum || tx.bankReference || "—"}</td>
          <td>${tx.party || tx.beneficiaryName || "—"}</td>
          <td>${tx.notes || "—"}</td>
          <td style="text-align:left; color:#be123c;">${debit > 0 ? formatMoney(debit) : "-"}</td>
          <td style="text-align:left; color:#15803d;">${credit > 0 ? formatMoney(credit) : "-"}</td>
          <td style="text-align:left; font-weight:bold; background:#f8fafc;">${formatMoney(runningBalance)}</td>
        </tr>
      `;
    }).join("");

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حركة الخزينة</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
          body { padding: 20px; color: #1e293b; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; line-height: 1.5; }
          th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: center; }
          tbody tr:nth-child(even) { background: #f8fafc; }
          tfoot td { background: #f1f5f9; font-size: 12px; font-weight: 700; border-top: 2px solid #94a3b8; }
          .summary-box { display: flex; justify-content: space-between; background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 20px; font-weight: 700; font-size: 13px; }
          ${getPrintBrandStyles()}
        </style>
      </head>
      <body>
        ${getPrintBrandHeader({ reportTitle: "كشف حركة الخزينة (مدين / دائن)", reportMeta: `تاريخ الاستخراج: ${new Date().toLocaleDateString('en-GB')} | عدد الحركات: ${visible.length}` })}
        
        <table style="margin-bottom: 10px; width: 30%; border:none;">
           <tr><td style="border:none; font-weight:700; padding:4px 0;">الرصيد الافتتاحي للحركات المعروضة: 0.00</td></tr>
        </table>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">م</th>
              <th style="width: 10%;">التاريخ</th>
              <th style="width: 10%;">المرجع</th>
              <th style="width: 18%;">الجهة / المستفيد</th>
              <th style="width: 25%;">البيان</th>
              <th style="width: 11%; text-align:left;">منصرف (مدين)</th>
              <th style="width: 11%; text-align:left;">وارد (دائن)</th>
              <th style="width: 11%; text-align:left;">الرصيد</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:left;">إجمالي الحركة</td>
              <td style="text-align:left; color:#be123c;">${formatMoney(totalDebit)}</td>
              <td style="text-align:left; color:#15803d;">${formatMoney(totalCredit)}</td>
              <td style="text-align:left;">${formatMoney(runningBalance)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="summary-box">
           <div>إجمالي الوارد: <span style="color:#15803d">${formatMoney(totalCredit)}</span></div>
           <div>إجمالي المنصرف: <span style="color:#be123c">${formatMoney(totalDebit)}</span></div>
           <div>صافي الرصيد النهائي: <span>${formatMoney(runningBalance)}</span></div>
        </div>

        <div style="margin-top:40px; display:flex; justify-content:space-between; font-weight:600; color:#475569;">
           <div>توقيع المراجع: .......................</div>
           <div>توقيع أمين الصندوق: .......................</div>
           <div>اعتماد المدير المالي: .......................</div>
        </div>
        <script>window.onload = () => { setTimeout(() => window.print(), 500); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500 font-medium text-lg animate-pulse">جاري بناء السجلات المالية...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir="rtl">
      <ErrorBoundary fallback="حدث خطأ في صفحة الماليات">

        {/* الترويسة المؤسسية الهادئة */}
        <div className="bg-white border-b border-slate-200 px-6 py-6 shadow-sm">
          <div className="max-w-[1500px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                <Building2 size={24} className="text-slate-700" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">الخزينة والماليات</h1>
                <p className="text-slate-500 mt-1 font-medium text-sm">مراقبة السيولة، الشيكات، وحالات التسوية المحاسبية.</p>
              </div>
            </div>

            {canCreateFinancial && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => openFormForType("advance")} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-sm">
                  <Plus size={16} /> إصدار سلفة
                </button>
                <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                  <button onClick={() => openFormForType("aid")} className="px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 transition-all">
                    <ShieldCheck size={16} className="text-slate-500" /> رعاية
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button onClick={() => openFormForType("event")} className="px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 transition-all">
                    <Star size={16} className="text-slate-500" /> فاعلية
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button onClick={() => openFormForType("bank_charge")} className="px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 transition-all">
                    <ArrowUpRight size={16} className="text-slate-500" /> خصم بنكي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-[1500px] mx-auto px-6 mt-8 space-y-6">
          <TreasuryStatsBar
            totalIssued={visible.filter(t => t.type !== "deposit").reduce((s, t) => s + (Number(t.amount) || 0), 0)}
            totalDirectCharges={visible.filter(t => DIRECT_FINANCE_TYPES.includes(t.type)).reduce((s, t) => s + (Number(t.amount) || 0), 0)}
            postedDirectCharges={visible.filter(t => DIRECT_FINANCE_TYPES.includes(t.type))}
            requiresSettlementCount={visible.filter(t => normalizeRequiresSettlement(t)).length}
            openSettlements={visible.filter(t => normalizeRequiresSettlement(t) && !t.isSettled).length}
            settledChecks={visible.filter(t => normalizeRequiresSettlement(t) && t.isSettled).length}
          />

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <TreasuryFilters
                searchQ={searchQ} setSearchQ={setSearchQ}
                filterType={filterType} setFilterType={setFilterType}
                filterState={filterState} setFilterState={setFilterState}
              />

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={resetFilters} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-all shadow-sm">
                  <FilterX size={16} /> تفريغ الفلاتر
                </button>
                <button onClick={handlePrintReport} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-all shadow-sm">
                  <Printer size={16} /> طباعة كشف
                </button>
                <select
                  onChange={(e) => { const f = e.target.value; if (f) handleExportExcel(f); e.target.value = ""; }}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer appearance-none transition-all shadow-sm"
                  style={{ direction: "ltr" }}
                >
                  <option value="">تصدير</option>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>

            <TreasuryTable
              visible={visible}
              paginatedVisible={paginatedVisible}
              showAll={showAll}
              setShowAll={setShowAll}
              canEditFinancial={canEditFinancial}
              canDeleteFinancial={canDeleteFinancial}
              canViewAttachments={canViewAttachments}
              onEdit={(tx) => { setSelectedTx(tx); setShowForm(true); }}
              onDelete={setDeleteTarget}
              onViewAttachments={setViewAttachments}
            />
          </div>
        </div>

        {/* 🔴 الشاشة المنبثقة بحجم الشاشة الكاملة 🔴 */}
        {showForm && (
          <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col animate-in fade-in duration-200">
            <div className="bg-white px-8 py-5 border-b border-slate-200 shadow-sm flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200"><Wallet size={20} /></div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                    {selectedTx ? "تعديل المستند المالي" : "إصدار مستند مالي جديد"}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">يُرجى التأكد من البيانات المدخلة قبل الحفظ أو الطباعة.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); navigate("/treasury/admin", { replace: true }); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-2"
              >
                إغلاق الشاشة <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Suspense fallback={<div className="flex justify-center items-center h-96 text-slate-500 font-medium animate-pulse">جاري تهيئة النموذج...</div>}>
                  <TreasuryForm
                    canPost={canPost}
                    nextCheque={nextCheque}
                    showToast={showToast}
                    onSubmit={async (data) => {
                      await saveTransaction(data);
                      setShowForm(false);
                      navigate("/treasury/admin", { replace: true });
                    }}
                    initialData={selectedTx}
                    onCancel={() => { setShowForm(false); navigate("/treasury/admin", { replace: true }); }}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* نافذة الحذف */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">تأكيد الحذف</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  هل أنت متأكد من حذف المستند المالي الخاص بـ <br />
                  <span className="text-base font-bold text-slate-900 mt-1 inline-block">{deleteTarget.party}</span>؟
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 flex gap-3 border-t border-slate-200">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all">
                  إلغاء
                </button>
                <button onClick={async () => {
                  try {
                    await deleteTransaction(deleteTarget);
                    setDeleteTarget(null);
                    showToast("تم الحذف بنجاح", "success");
                  } catch (e) {
                    setError(e.message);
                    showToast(e.message || "فشل الحذف", "error");
                  }
                }} className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all">
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )}

      </ErrorBoundary>
    </div>
  );
}