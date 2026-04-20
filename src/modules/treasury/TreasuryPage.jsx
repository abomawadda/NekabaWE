import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useTreasuryService } from "./services/treasuryService";
import { WORKFLOW_LABELS } from "./helpers/workflow";
import {
  DIRECT_FINANCE_TYPES,
  getLegacyChecksMigrationPreview,
  getIssuedCheckTypeLabel,
  isGroupedSettlementFollower,
  isDirectFinanceType,
  mergeIssuedChecksSourcesNormalized,
  normalizeRequiresSettlement,
  normalizeIssuedCheckType,
} from "./helpers/issuedChecks";
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
  Landmark,
  ReceiptText,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useT } from "../../app/providers/ThemeProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { formatMoney } from "../../utils/numberFormat";
import { logAuditEvent } from "../../utils/auditLog";
import { filterDataByScope, PERMISSIONS } from "../../security/permissions";
import clsx from "clsx";

const TYPE_LABELS = {
  aid: "إعانة",
  budget: "ميزانيات",
  activities: "أنشطة",
  trip: "رحلات",
  event: "فاعليات",
  advance: "سلفة",
  other: "أخرى",
  bank_charge: "خصم مباشر",
};

const TYPE_ICONS = {
  aid: <ArrowUpRight size={14} className="text-rose-500" />,
  budget: <Wallet size={14} className="text-sky-500" />,
  activities: <Star size={14} className="text-amber-500" />,
  trip: <RefreshCw size={14} className="text-indigo-500" />,
  event: <Star size={14} className="text-orange-500" />,
  advance: <ArrowUpRight size={14} className="text-purple-500" />,
  other: <Landmark size={14} className="text-slate-500" />,
  bank_charge: <ReceiptText size={14} className="text-slate-500" />,
};

const COLOR_STYLES = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const getCheckSortValue = (value) => {
  const normalized = String(value || "").replace(/[\u0660-\u0669]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && normalized !== "" ? parsed : Number.MAX_SAFE_INTEGER;
};

const getTxDetails = (tx) => {
  if (tx.type === "bank_charge") {
    return [
      tx.bankChargeCategory ? `تصنيف الخصم: ${tx.bankChargeCategory}` : "",
      tx.bankReference ? `مرجع البنك: ${tx.bankReference}` : "",
      tx.notes,
    ]
      .filter(Boolean)
      .join(" - ") || "خصم مباشر من كشف الحساب";
  }

  const parts = [
    getIssuedCheckTypeLabel(tx.type) ? `النوع: ${getIssuedCheckTypeLabel(tx.type)}` : "",
    tx.expenseItem ? `بند الصرف: ${tx.expenseItem}` : "",
    tx.activityName,
    tx.notes,
    normalizeRequiresSettlement(tx) ? "يتطلب تسوية" : "لا يتطلب تسوية",
  ].filter(Boolean);
  return parts.join(" - ") || "—";
};

const getTxCheckRef = (tx) => tx.checkNum || tx.bankReference || "—";
const formatCheckRef = (value) => {
  if (!value || value === "—") return "—";
  const normalized = String(value).replace(/[\u0660-\u0669]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? formatMoney(parsed) : value;
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

export default function TreasuryPage() {
  const T = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, can, user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [issuedChecks, setIssuedChecks] = useState([]);
  const [legacyTransactions, setLegacyTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewAttachments, setViewAttachments] = useState(null);
  const [toast, setToast] = useState(null);
  const [isMigratingLegacy, setIsMigratingLegacy] = useState(false);

  const { deleteTransaction, saveTransaction, migrateLegacyChecksToIssuedChecks } =
    useTreasuryService();
  const canCreateFinancial = can(PERMISSIONS.treasuryCreate);
  const canEditFinancial = can(PERMISSIONS.treasuryEdit);
  const canDeleteFinancial = can(PERMISSIONS.treasuryDelete);
  const canMigrateLegacy = can(PERMISSIONS.treasuryMigrate);
  const canViewAttachments = can(PERMISSIONS.attachmentsView);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const requestedType = normalizeIssuedCheckType(params.get("type") || "");
    const requestedFilter = params.get("filter") || "";

    if (requestedFilter === "draft") {
      setFilterState("draft");
    } else if (!params.get("type")) {
      setFilterState("all");
    }

    if (requestedType && TYPE_LABELS[requestedType] && canCreateFinancial) {
      setShowForm(true);
      setSelectedTx(null);
    } else if (!selectedTx) {
      setShowForm(false);
    }
  }, [location.search, selectedTx, canCreateFinancial]);

  useEffect(() => {
    let checksReady = false;
    let legacyReady = false;
    const finishLoading = () => {
      if (checksReady && legacyReady) setLoading(false);
    };

    const qChecks = query(collection(db, "issued_checks"), orderBy("date", "asc"));
    const unsubChecks = onSnapshot(
      qChecks,
      (snap) => {
        setIssuedChecks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        checksReady = true;
        finishLoading();
      },
      (error) => {
        console.error("issued_checks:", error);
        setIssuedChecks([]);
        checksReady = true;
        finishLoading();
      }
    );

    const qLegacy = query(collection(db, "transactions"), orderBy("date", "asc"));
    const unsubLegacy = onSnapshot(
      qLegacy,
      (snap) => {
        setLegacyTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        legacyReady = true;
        finishLoading();
      },
      (error) => {
        console.error("transactions:", error);
        setLegacyTransactions([]);
        legacyReady = true;
        finishLoading();
      }
    );

    return () => {
      unsubChecks();
      unsubLegacy();
    };
  }, []);

  useEffect(() => {
    const directFinanceEntries = legacyTransactions
      .filter((tx) => DIRECT_FINANCE_TYPES.includes(tx.type))
      .map((tx) => ({ ...tx, sourceCollection: "transactions" }));

    const normalizedChecks = mergeIssuedChecksSourcesNormalized(
      issuedChecks,
      legacyTransactions
    ).filter((tx) => !isGroupedSettlementFollower(tx));

    setTransactions([
      ...normalizedChecks,
      ...directFinanceEntries,
    ]);
  }, [issuedChecks, legacyTransactions]);

  const migrationPreview = useMemo(
    () => getLegacyChecksMigrationPreview(legacyTransactions, issuedChecks),
    [legacyTransactions, issuedChecks]
  );

  const posted = useMemo(
    () => transactions.filter((t) => t.state === "posted" || t.state === "approved" || !t.state),
    [transactions]
  );

  const postedChecks = useMemo(
    () => posted.filter((t) => !DIRECT_FINANCE_TYPES.includes(t.type)),
    [posted]
  );

  const postedDirectCharges = useMemo(
    () => posted.filter((t) => DIRECT_FINANCE_TYPES.includes(t.type)),
    [posted]
  );

  const totalIssued = useMemo(
    () => postedChecks.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [postedChecks]
  );

  const totalDirectCharges = useMemo(
    () => postedDirectCharges.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [postedDirectCharges]
  );

  const requiresSettlementCount = useMemo(
    () => posted.filter((t) => normalizeRequiresSettlement(t)).length,
    [posted]
  );

  const openSettlements = useMemo(
    () => posted.filter((t) => normalizeRequiresSettlement(t) && !t.isSettled).length,
    [posted]
  );

  const settledChecks = useMemo(
    () => posted.filter((t) => normalizeRequiresSettlement(t) && t.isSettled).length,
    [posted]
  );

  const nextCheque = useMemo(() => {
    const nums = transactions
      .map((t) => Number(t.checkNum))
      .filter((n) => Number.isFinite(n) && n > 0);
    return (nums.length ? Math.max(...nums) : 10250) + 1;
  }, [transactions]);

  const visible = useMemo(() => {
    const queryText = searchQ.trim().toLowerCase();
    const scopedTransactions = filterDataByScope(transactions, "treasury", user);

    return scopedTransactions
      .filter((t) => filterType === "all" || t.type === filterType)
      .filter((t) => filterState === "all" || (t.state || "posted") === filterState)
      .filter((t) => {
        if (!queryText) return true;
        return [
          t.party,
          t.beneficiaryName,
          getIssuedCheckTypeLabel(t.type),
          t.notes,
          t.expenseItem,
          t.bankChargeCategory,
          t.bankReference,
          t.activityName,
          t.checkNum,
          getTxDetails(t),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(queryText));
      })
      .sort((a, b) => {
        const byDate = String(a.date || "").localeCompare(String(b.date || ""));
        if (byDate !== 0) return byDate;

        const byCheck = getCheckSortValue(getTxCheckRef(a)) - getCheckSortValue(getTxCheckRef(b));
        if (byCheck !== 0) return byCheck;

        return String(getTxCheckRef(a)).localeCompare(String(getTxCheckRef(b)), "ar");
      });
  }, [transactions, filterType, filterState, searchQ, user]);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setSelectedTx(null);
    navigate("/treasury/admin", { replace: true });
  }, [navigate]);

  const handleSave = async (data, isEdit) => {
    if ((isEdit && !canEditFinancial) || (!isEdit && !canCreateFinancial)) {
      showToast("لا تملك صلاحية تنفيذ هذا الإجراء المالي", "error");
      return;
    }
    try {
      const payload = {
        ...data,
        createdBy: data.createdBy || user?.displayName || user?.fullName || "",
        createdById: data.createdById || user?.id || "",
        userId: data.userId || user?.id || "",
      };
      const savedId = await saveTransaction(payload);
      const targetCollection = isDirectFinanceType(data.type) ? "transactions" : "issued_checks";
      const savedRecord = {
        ...payload,
        id: savedId,
        type: normalizeIssuedCheckType(data.type),
        sourceCollection: targetCollection,
        updatedAt: new Date().toISOString(),
      };

      if (targetCollection === "issued_checks") {
        setIssuedChecks((prev) => {
          const next = prev.filter((item) => item.id !== savedId);
          return [...next, savedRecord];
        });
      } else {
        setLegacyTransactions((prev) => {
          const next = prev.filter((item) => item.id !== savedId);
          return [...next, savedRecord];
        });
      }

      const savedLabel = data.type === "bank_charge" ? "الحركة المالية المباشرة" : "الشيك";
      await logAuditEvent(isEdit ? "treasury.update" : "treasury.create", {
        targetId: savedId,
        after: {
          type: payload.type,
          amount: payload.amount,
          party: payload.party || payload.beneficiaryName,
        },
        riskLevel: isEdit ? "medium" : "high",
        page: "/treasury/admin",
      });
      showToast(isEdit ? `تم تحديث ${savedLabel} بنجاح` : `تم حفظ ${savedLabel} بنجاح`);

      if (isEdit) {
        handleCloseForm();
      } else {
        setSelectedTx(null);
      }
    } catch (error) {
      console.error(error);
      showToast("حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى", "error");
      throw error;
    }
  };

  const handleEdit = (tx) => {
    if (!canEditFinancial) {
      showToast("صلاحية التعديل غير متاحة لدورك الحالي", "error");
      return;
    }
    setSelectedTx(tx);
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!canDeleteFinancial) {
      showToast("صلاحية الحذف المالي غير متاحة", "error");
      return;
    }
    try {
      const targetCollection = deleteTarget?.sourceCollection || (isDirectFinanceType(deleteTarget?.type) ? "transactions" : "issued_checks");
      await deleteTransaction(deleteTarget);
      if (targetCollection === "issued_checks") {
        setIssuedChecks((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      } else {
        setLegacyTransactions((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      }
      await logAuditEvent("treasury.delete", {
        targetId: deleteTarget.id,
        before: {
          type: deleteTarget.type,
          amount: deleteTarget.amount,
          party: deleteTarget.party || deleteTarget.beneficiaryName,
        },
        riskLevel: "high",
        page: "/treasury/admin",
      });
      setDeleteTarget(null);
      showToast(deleteTarget?.type === "bank_charge" ? "تم حذف الحركة المباشرة بنجاح" : "تم حذف الشيك بنجاح");
    } catch (error) {
      console.error(error);
      showToast("تعذر حذف الشيك", "error");
    }
  };

  const handleMigrateLegacyChecks = async () => {
    if (!canMigrateLegacy) {
      showToast("ترحيل السجلات القديمة محصور بأمين الصندوق", "error");
      return;
    }
    try {
      setIsMigratingLegacy(true);
      const result = await migrateLegacyChecksToIssuedChecks({
        legacyTransactions,
        issuedChecks,
      });
      await logAuditEvent("treasury.migrate_legacy_checks", {
        migratedCount: result.migratedCount,
        riskLevel: "high",
        page: "/treasury/admin",
      });

      showToast(
        result.migratedCount > 0
          ? `تم ترحيل ${result.migratedCount} شيك قديم إلى السجل الموحد بنجاح`
          : "لا توجد شيكات قديمة جديدة بحاجة إلى ترحيل"
      );
    } catch (error) {
      console.error(error);
      showToast("تعذر ترحيل الشيكات القديمة، يرجى المحاولة مرة أخرى", "error");
    } finally {
      setIsMigratingLegacy(false);
    }
  };

  if (loading) {
    return <div className="text-center p-20 text-slate-400 font-bold animate-pulse">جارٍ تحميل السجلات المالية...</div>;
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
              <FileText size={16} className="text-teal-600" /> المرفقات ({viewAttachments.length})
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
                <p className="text-[11px] font-bold text-slate-400 mt-1">لن يمكن التراجع عن هذا الإجراء بعد التنفيذ</p>
              </div>
            </div>
            <p className="text-sm font-bold text-slate-600">
              هل تريد حذف {deleteTarget.type === "bank_charge" ? "الحركة المباشرة" : "الشيك"} الخاص بـ <span className="text-rose-600">{deleteTarget.party || deleteTarget.beneficiaryName || deleteTarget.bankChargeCategory || "—"}</span>؟
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
              <h1 className="text-xl font-black">الماليات</h1>
              <p className={clsx("text-xs font-bold mt-1", T.muted)}>إدارة الشيكات الصادرة والخصومات البنكية المباشرة داخل شاشة مالية موحدة مع التوافق مع البيانات السابقة</p>
            </div>
            {canCreateFinancial && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => navigate("/treasury/admin?type=aid")} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-2 hover:bg-rose-700">
                  <Plus size={14} /> شيك إعانة
                </button>
                <button onClick={() => navigate("/treasury/admin?type=advance")} className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-2 hover:bg-purple-700">
                  <Plus size={14} /> شيك سلفة
                </button>
                <button onClick={() => navigate("/treasury/admin?type=trip")} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-2 hover:bg-indigo-700">
                  <Plus size={14} /> شيك رحلة
                </button>
                <button onClick={() => navigate("/treasury/admin?type=event")} className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-black flex items-center gap-2 hover:bg-amber-700">
                  <Star size={14} /> شيك فاعلية
                </button>
                <button onClick={() => navigate("/treasury/admin?type=other")} className="px-4 py-2.5 rounded-xl bg-slate-700 text-white text-xs font-black flex items-center gap-2 hover:bg-slate-800">
                  <Landmark size={14} /> شيك آخر
                </button>
                <button onClick={() => navigate("/treasury/admin?type=bank_charge")} className="px-4 py-2.5 rounded-xl bg-slate-500 text-white text-xs font-black flex items-center gap-2 hover:bg-slate-600">
                  <ReceiptText size={14} /> خصم مباشر
                </button>
              </div>
            )}
          </div>

          {migrationPreview.totalLegacy > 0 && (
            <div
              className={clsx(
                "p-4 rounded-2xl border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3",
                T.card
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-black">
                  <RefreshCw
                    size={16}
                    className={clsx(
                      migrationPreview.pendingCount > 0
                        ? "text-amber-600"
                        : "text-emerald-600"
                    )}
                  />
                  <span>ترحيل السجلات القديمة إلى `issued_checks`</span>
                </div>
                <p className={clsx("text-xs font-bold", T.muted)}>
                  تم رصد {migrationPreview.totalLegacy} شيك قديم داخل `transactions`.
                  المتبقي للترحيل {migrationPreview.pendingCount}، والمرحّل بالفعل{" "}
                  {migrationPreview.alreadyMigrated}.
                </p>
                <p className="text-[11px] font-bold text-slate-500">
                  الترحيل آمن ومكررته محمية؛ أي سجل تم ترحيله سابقًا لن يظهر مرة ثانية داخل الشاشة أو التقارير.
                </p>
              </div>

              {canMigrateLegacy && (
                <button
                  onClick={handleMigrateLegacyChecks}
                  disabled={isMigratingLegacy || migrationPreview.pendingCount === 0}
                  className={clsx(
                    "px-4 py-2.5 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2 min-w-[220px]",
                    isMigratingLegacy || migrationPreview.pendingCount === 0
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-teal-600 hover:bg-teal-700"
                  )}
                >
                  <RefreshCw
                    size={14}
                    className={clsx(isMigratingLegacy && "animate-spin")}
                  />
                  {isMigratingLegacy
                    ? "جارٍ ترحيل السجلات..."
                    : migrationPreview.pendingCount > 0
                      ? `ترحيل ${migrationPreview.pendingCount} شيك قديم`
                      : "كل السجلات القديمة مُرحّلة"}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <StatCard label="إجمالي الشيكات" value={formatMoney(totalIssued)} icon={TrendingDown} color="rose" />
            <StatCard label="خصومات مباشرة" value={formatMoney(totalDirectCharges)} icon={ReceiptText} color="amber" sub={`${postedDirectCharges.length} حركة مباشرة`} />
            <StatCard label="شيكات تتطلب تسوية" value={`${requiresSettlementCount}`} icon={Wallet} color="teal" />
            <StatCard label="تسويات مفتوحة" value={`${openSettlements}`} icon={RefreshCw} color="amber" sub="سلف ورحلات وفاعليات وشيكات معلّمة للتسوية" />
            <StatCard label="تسويات مغلقة" value={`${settledChecks}`} icon={TrendingUp} color="emerald" />
          </div>

          <div className={clsx("p-4 rounded-2xl border shadow-sm", T.card)}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="بحث بالمستفيد أو نوع الحركة أو بند الصرف أو رقم الشيك أو المرجع البنكي"
                  className={clsx("w-full pr-9 pl-3 py-2.5 rounded-xl border text-xs font-bold", T.inp)}
                />
              </div>

              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={clsx("px-3 py-2.5 rounded-xl border text-xs font-bold", T.sel)}>
                <option value="all">كل الأنواع</option>
                <option value="aid">إعانة</option>
                <option value="budget">ميزانيات</option>
                <option value="activities">أنشطة</option>
                <option value="trip">رحلات</option>
                <option value="event">فاعليات</option>
                <option value="advance">سلفة</option>
                <option value="other">أخرى</option>
                <option value="bank_charge">خصم مباشر</option>
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
                    <th className="py-3 px-4 text-right text-[10px] font-black text-slate-500">المستفيد / البيان</th>
                    <th className="py-3 px-4 text-center text-[10px] font-black text-slate-500">القيمة</th>
                    <th className="py-3 px-4 text-center text-[10px] font-black text-slate-500">رقم الشيك / المرجع</th>
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
                          {TYPE_LABELS[normalizeIssuedCheckType(tx.type)] || tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs font-black">{tx.party || tx.beneficiaryName || tx.bankChargeCategory || "—"}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">{getTxDetails(tx)}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-sm">
                        <span className="text-rose-600">{formatMoney(tx.amount || 0)}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-[10px] font-bold text-slate-400">{formatCheckRef(getTxCheckRef(tx))}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={clsx("text-[9px] px-2 py-0.5 rounded-full font-black border inline-block", tx.state === "posted" ? "bg-teal-500/10 text-teal-600 border-teal-500/20" : tx.state === "draft" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20")}>
                          {WORKFLOW_LABELS[tx.state] || tx.state || "مرحل"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tx.attachments?.length > 0 && canViewAttachments ? (
                          <button onClick={() => setViewAttachments(tx.attachments)} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-all text-[10px] font-bold">
                            <FileText size={11} /> {tx.attachments.length}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEditFinancial && (
                            <button onClick={() => handleEdit(tx)} title="تعديل" className="p-1.5 text-sky-600 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 rounded-lg transition-colors">
                              <Edit size={14} />
                            </button>
                          )}
                          {canDeleteFinancial && (
                            <button onClick={() => setDeleteTarget(tx)} title="حذف" className="p-1.5 text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
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
                        <span className="text-rose-600">{formatMoney(visible.reduce((s, t) => s + Number(t.amount || 0), 0))}</span>
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
}
