/**
 * SettlementTab — شاشة تسوية السلف والفاعليات
 *
 * ✅ ميزة تسوية الفاعليات: (قيمة الشيك + اشتراكات محصلة = ميزانية الفاعلية).
 * ✅ حفظ مؤقت للفواتير.
 * ✅ بدون شاشة بيضاء بفضل الـ Local Print & Snapshot Modal.
 */

import React, { useState, useMemo, useEffect } from "react";
import { collection, query, onSnapshot, doc, setDoc, orderBy, writeBatch, where } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import FileUpload from "../treasury/FileUpload"; 
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import BrandHeader from "../../ui/BrandHeader";
import { getPrintBrandHeader, getPrintBrandStyles } from "../../utils/branding";
import { logAuditEvent } from "../../utils/auditLog";
import {
  getDeathDate,
  getMembershipEndDate,
  isBoardMember,
  parseEmployeeDate,
} from "../../utils/memberBenefits";
import { formatMoney } from "../../utils/numberFormat";
import { openPrintWindow } from "../../utils/print";
import {
  buildLegacyIssuedCheckId,
  getDefaultRequiresSettlement,
  getIssuedCheckDisplayParty,
  getSettlementMode,
  isLegacyCheckType,
  LEGACY_ISSUED_CHECK_PREFIX,
  mergeIssuedChecksSources,
  normalizeIssuedCheckType,
  normalizeRequiresSettlement,
} from "../treasury/helpers/issuedChecks";
import { ReceiptText, Plus, Trash2, Printer, CheckCircle2, FileText, Tag, DollarSign, Wallet, History, Search, AlertCircle, Info, ShieldCheck, ArrowDownRight, X, Check, Users, Save, AlertTriangle, Loader2, Edit3, RotateCcw } from "lucide-react";
import clsx from "clsx";

const INITIAL_CATS = ["بدل ضيافة", "أدوات مكتبية", "بدل انتقال", "صيانة", "مشتريات أخرى", "بدل جلسات"];
const SESSION_ALLOWANCE_CATEGORIES = ["بدل جلسات"];
const HOSPITALITY_ALLOWANCE_CATEGORIES = ["بدل ضيافة", "ضيافة وبوفيه"];
const ALLOWANCE_TYPE_LABELS = {
  sessions: "بدل الجلسات",
  hospitality: "بدل الضيافة",
};
const getTodayISO = () => new Date().toISOString().split("T")[0];
const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const getMonthValue = (dateString = "") => (dateString || "").slice(5, 7);
const getYearValue = (dateString = "") => (dateString || "").slice(0, 4);
const parseFlexibleDate = (value) => {
  const parsed = parseEmployeeDate(value);
  if (parsed) return parsed;
  if (!value) return null;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};
const getDateTimestamp = (value) => {
  const parsed = parseFlexibleDate(value);
  return parsed ? parsed.getTime() : 0;
};
const getMeetingAllowanceType = (category = "") => {
  if (SESSION_ALLOWANCE_CATEGORIES.includes(category)) return "sessions";
  if (HOSPITALITY_ALLOWANCE_CATEGORIES.includes(category)) return "hospitality";
  return "";
};
const isMeetingAllowanceCategory = (category = "") => Boolean(getMeetingAllowanceType(category));
const getLatestSettlementExpenseDate = (expenses = [], fallback = "") => {
  const datedExpenses = (Array.isArray(expenses) ? expenses : [])
    .map((expense) => ({
      raw: expense?.date || "",
      timestamp: getDateTimestamp(expense?.date),
    }))
    .filter((entry) => entry.raw);
  if (datedExpenses.length === 0) return fallback || "";
  datedExpenses.sort((a, b) => (b.timestamp - a.timestamp) || String(b.raw).localeCompare(String(a.raw)));
  return datedExpenses[0]?.raw || fallback || "";
};
const getSettlementApprovalDate = (settlement = {}) =>
  getLatestSettlementExpenseDate(
    settlement?.settlementExpenses,
    settlement?.settlementDate || settlement?.date || ""
  );
const getSettlementChequeDate = (settlement = {}) => settlement?.date || settlement?.checkDate || settlement?.issueDate || "";
const getSettlementChequeNumber = (settlement = {}) => {
  const numeric = Number(settlement?.checkNum || settlement?.checkNo || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};
const getSettlementReturnMode = (settlement = {}) => {
  const explicitMode = String(settlement?.returnMode || "").trim();
  if (explicitMode) return explicitMode;
  if (settlement?.returnedActually) return "cash_return";
  return Number(settlement?.settlementReturned || 0) > 0 ? "carry_forward" : "settled";
};
const getSettlementReturnedLabel = (settlement = {}) => {
  const returnMode = getSettlementReturnMode(settlement);
  if (returnMode === "bank_deposit") return "تم إيداعه بالبنك";
  if (returnMode === "cash_return") return "تم الرد نقدًا";
  if (returnMode === "carry_forward") return "مرحّل للقادم";
  return "تمت التسوية";
};
const getSettlementEffectiveRemaining = (settlement = {}) => {
  const returnMode = getSettlementReturnMode(settlement);
  if (returnMode === "carry_forward") return Number(settlement?.settlementReturned || 0);
  if (returnMode === "bank_deposit") {
    return Number(settlement?.bankDepositedAmount || settlement?.settlementReturned || 0);
  }
  if (returnMode === "cash_return") {
    return Number(settlement?.returnedCashAmount || settlement?.settlementReturned || 0);
  }
  return Number(settlement?.settlementReturned || 0);
};
const getSettlementSortTimestamp = (settlement = {}) =>
  getDateTimestamp(getSettlementApprovalDate(settlement)) ||
  getDateTimestamp(settlement?.updatedAt) ||
  getDateTimestamp(settlement?.settlementDate) ||
  getDateTimestamp(settlement?.date) ||
  getDateTimestamp(settlement?.createdAt);
const compareSettlementSequenceDesc = (a = {}, b = {}) => {
  const dateDiff = getDateTimestamp(getSettlementChequeDate(b)) - getDateTimestamp(getSettlementChequeDate(a));
  if (dateDiff !== 0) return dateDiff;

  const chequeDiff = getSettlementChequeNumber(b) - getSettlementChequeNumber(a);
  if (chequeDiff !== 0) return chequeDiff;

  const approvalDiff = getSettlementSortTimestamp(b) - getSettlementSortTimestamp(a);
  if (approvalDiff !== 0) return approvalDiff;

  return String(b.id || "").localeCompare(String(a.id || ""));
};

const normalizeDateOnly = (value) => {
  const parsed = parseEmployeeDate(value);
  return parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null;
};

const getBoardSettlementEndDate = (member) => {
  const membershipEndDate = getMembershipEndDate(member);
  const deathDate = getDeathDate(member);

  if (membershipEndDate && deathDate) {
    return membershipEndDate.getTime() <= deathDate.getTime() ? membershipEndDate : deathDate;
  }

  return membershipEndDate || deathDate || null;
};

const isBoardMemberEligibleForSettlementDate = (member, onDate) => {
  if (!isBoardMember(member)) return false;

  const referenceDate = normalizeDateOnly(onDate) || normalizeDateOnly(new Date());
  const boardEndDate = normalizeDateOnly(getBoardSettlementEndDate(member));

  if (!boardEndDate) return true;
  return referenceDate.getTime() <= boardEndDate.getTime();
};

const getSettlementSourceKey = (tx = {}) => {
  const id = String(tx?.id || "");
  if (tx?.legacySourceId) return String(tx.legacySourceId);
  if (tx?.sourceTransactionId) return String(tx.sourceTransactionId);
  if (id.startsWith(LEGACY_ISSUED_CHECK_PREFIX)) {
    return id.slice(LEGACY_ISSUED_CHECK_PREFIX.length);
  }
  return id;
};

// ── دالة الطباعة المدمجة لمنع خطأ المتصفح ──
const printSettlementLocal = ({
  advanceTxn,
  expenses,
  spent,
  remaining,
  prevBalance = 0,
  collectedSubs = 0,
  returnMode = "settled",
  bankDepositDate = "",
  bankDepositReference = "",
}) => {
  const win = openPrintWindow("settlement-local", "width=950,height=750");
  if (!win) return;

  const ADV_AMT = Number(advanceTxn?.advanceAmountBase || advanceTxn?.amount || 0);
  const SUBS_AMT = Number(collectedSubs || 0);
  const TOTAL_AVAILABLE = ADV_AMT + Number(prevBalance) + Number(collectedSubs);

  const rowsHtml = expenses?.length > 0 
    ? expenses.map((e, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:center">${e.date}</td><td style="color:#0f766e">${e.category}</td><td>${e.notes || "—"}</td><td style="text-align:left; font-weight:900">${formatMoney(e.amount)}</td></tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">لم يتم إدراج فواتير</td></tr>`;

  const settlementFooter =
    remaining > 0
      ? `يوجد مبلغ متبقٍ قدره (${formatMoney(remaining)}) — ${
          returnMode === "bank_deposit"
            ? `تم إيداعه بالبنك${bankDepositDate ? ` بتاريخ ${bankDepositDate}` : ""}${bankDepositReference ? ` بموجب المرجع ${bankDepositReference}` : ""}.`
            : returnMode === "cash_return"
              ? "تم توريده نقداً لخزينة النقابة بموجب إيصال."
              : "تم ترحيله كـ 'رصيد دائن' ليُخصم من السلفة القادمة."
        }`
      : remaining < 0
        ? `يوجد تجاوز في الصرف قدره (${formatMoney(Math.abs(remaining))}) — يُصرف للموظف.`
        : `تم تسوية العهدة بالكامل (صفر).`;

  win.document.write(`
    <!DOCTYPE html><html lang="ar">
    <head><meta charset="UTF-8"><title>تسوية ${advanceTxn?.settlement_mode === 'carry_forward' ? 'عهدة' : 'شيك'} - ${advanceTxn?.employeeName || advanceTxn?.party}</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');*{font-family:'Cairo',sans-serif;margin:0;padding:0;box-sizing:border-box;direction:rtl;}body{padding:30px;color:#1e293b;background:#fff;}.badge{display:inline-block;padding:5px 15px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:20px;font-size:12px;font-weight:700;color:#0f766e;}.info-row{margin-bottom:20px;padding:15px;background:#f8fafc;border-right:4px solid #0d9488;border-radius:8px;font-size:16px;font-weight:bold;}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}.stat-box{border:1px solid #e2e8f0;padding:15px;border-radius:10px;text-align:center;}.stat-label{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:5px;text-transform:uppercase;}.stat-value{font-size:20px;font-weight:900;}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}th{background:#f1f5f9;color:#0f766e;border:1px solid #cbd5e1;padding:12px;text-align:right;font-weight:900;}td{border:1px solid #cbd5e1;padding:10px;text-align:right;font-weight:700;}.footer-note{margin-top:15px;padding:10px;background:#fefce8;border:1px solid #fef08a;border-radius:8px;font-size:13px;font-weight:bold;color:#854d0e;}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:50px;text-align:center;}.sig-box{border-top:2px dashed #cbd5e1;padding-top:10px;font-size:14px;font-weight:900;color:#475569;}.sig-space{height:60px;}@media print{@page{size:A4 portrait;margin:10mm;}body{padding:0;}}${getPrintBrandStyles()}</style>
    </head><body>
      ${getPrintBrandHeader({ reportTitle: `كشف تسوية ${advanceTxn?.settlement_mode === 'carry_forward' ? 'عهدة مالية' : 'شيك مصروف'}`, reportMeta: `تاريخ الاعتماد: ${getLatestSettlementExpenseDate(expenses, advanceTxn?.settlementDate || advanceTxn?.date || '—') || '—'}` })}
      <div class="info-row">اسم مسؤول التسوية: <span style="font-size:20px; color:#0d9488; margin-right: 10px;">${advanceTxn?.employeeName || advanceTxn?.party || '—'}</span></div>
      <div class="stats-grid">
        <div class="stat-box"> <div class="stat-label">قيمة الشيك المُنصرف</div> <div class="stat-value" style="color:#334155">${formatMoney(ADV_AMT)}</div> </div>
        <div class="stat-box"> <div class="stat-label">${advanceTxn?.settlement_mode === 'check_plus_subscriptions' ? 'اشتراكات الأعضاء' : 'رصيد مرحل من قبل'}</div> <div class="stat-value" style="color:#d97706">${advanceTxn?.settlement_mode === 'check_plus_subscriptions' ? formatMoney(SUBS_AMT) : formatMoney(prevBalance)}</div> </div>
        <div class="stat-box" style="background:#f0fdf4; border-color:#86efac"> <div class="stat-label" style="color:#15803d">إجمالي ميزانية التسوية</div> <div class="stat-value" style="color:#166534">${formatMoney(TOTAL_AVAILABLE)}</div> </div>
        <div class="stat-box" style="background:#fff1f2; border-color:#fda4af"> <div class="stat-label" style="color:#e11d48">المنصرف الفعلي بالفواتير</div> <div class="stat-value" style="color:#be123c">${formatMoney(spent)}</div> </div>
      </div>
      <h3 style="margin-bottom:10px; color:#334155; font-size: 14px;">بيان الفواتير والمصروفات المدرجة:</h3>
      <table><thead><tr><th style="width:40px; text-align:center;">م</th><th style="width:100px; text-align:center;">التاريخ</th><th style="width:150px;">التصنيف المحاسبي</th><th>البيان والملاحظات</th><th style="width:120px;">المبلغ</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="footer-note">الحالة النهائية للتسوية: ${settlementFooter}</div>
      <div class="sigs"><div class="sig-box">توقيع المسؤول<div class="sig-space"></div></div><div class="sig-box">المراجعة والرقابة<div class="sig-space"></div></div><div class="sig-box">يعتمد، أمين الصندوق<div class="sig-space"></div></div></div>
      <script>window.onload=()=>{setTimeout(()=>window.print(), 500);}</script>
    </body></html>
  `);
  win.document.close();
};

function FinanceCard({ label, value, color, icon: Icon, isTotal }) {
  const safeValue = formatMoney(value || 0);
  return (
    <div className={clsx("p-3 rounded-xl border flex flex-col justify-center transition-all", isTotal ? `bg-${color}-600 text-white border-${color}-700 shadow-md` : `bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800`)}>
      <div className="flex items-center gap-1.5 mb-1 opacity-90">{Icon && <Icon size={12} />}<p className="text-[9px] font-black uppercase tracking-widest">{label}</p></div>
      <p className={clsx("text-lg font-black", !isTotal && `text-${color}-700 dark:text-${color}-400`)}>{safeValue}</p>
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
  const [issuedChecks,  setIssuedChecks]  = useState([]);
  const [legacyTransactions, setLegacyTransactions] = useState([]);
  const [employees,     setEmployees]     = useState([]);
  const [boardMeetings, setBoardMeetings] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  
  const [selAdvId,      setSelAdvId]      = useState("");
  const [settlementDate,setSettlementDate]= useState(getTodayISO());
  const [expenses,      setExpenses]      = useState([]);
  const [returnedActually, setReturnedActually] = useState(false);
  const [returnMode, setReturnMode] = useState("carry_forward");
  const [returnDepositDate, setReturnDepositDate] = useState(getTodayISO());
  const [returnDepositReference, setReturnDepositReference] = useState("");
  const [saving,        setSaving]        = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveMonth,  setArchiveMonth]  = useState("all");
  const [archiveYear,   setArchiveYear]   = useState("all");
  
  // 🎯 الميزانية الإضافية للفاعليات (الاشتراكات المحصلة)
  const [collectedSubs, setCollectedSubs] = useState("");
  
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [expenseToDelete,  setExpenseToDelete]  = useState(null); 
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSettlementId, setEditingSettlementId] = useState("");
  const [settlementToDelete, setSettlementToDelete] = useState(null);
  
  const [expAmt,        setExpAmt]        = useState("");
  const [expCat,        setExpCat]        = useState(INITIAL_CATS[0]);
  const [expNotes,      setExpNotes]      = useState("");
  const [expDate,       setExpDate]       = useState(getTodayISO());
  const [expFiles,      setExpFiles]      = useState([]);
  const [expMeetingId,  setExpMeetingId]  = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  const resetSettlementReturnState = (mode = "carry_forward") => {
    setReturnedActually(mode === "cash_return");
    setReturnMode(mode);
    setReturnDepositDate(getTodayISO());
    setReturnDepositReference("");
  };

  useEffect(() => {
    let checksReady = false;
    let legacyReady = false;
    let empsReady = false;
    let meetingsReady = false;
    const finishLoading = () => {
      if (checksReady && legacyReady && empsReady && meetingsReady) setLoading(false);
    };

    const qChecks = query(collection(db, "issued_checks"), orderBy("date", "desc"));
    const unsubChecks = onSnapshot(qChecks, snap => {
      setIssuedChecks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      checksReady = true;
      finishLoading();
    }, err => {
      console.error("issued_checks:", err);
      setIssuedChecks([]);
      checksReady = true;
      finishLoading();
    });

    const qLegacy = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubLegacy = onSnapshot(qLegacy, snap => {
      setLegacyTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      legacyReady = true;
      finishLoading();
    }, err => {
      console.error("transactions:", err);
      setLegacyTransactions([]);
      legacyReady = true;
      finishLoading();
    });

    const qEmps = query(collection(db, "employees"));
    const unsubEmps = onSnapshot(qEmps, snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      empsReady = true;
      finishLoading();
    }, err => {
      console.error("employees:", err);
      setEmployees([]);
      empsReady = true;
      finishLoading();
    });

    const qMeetings = query(collection(db, "board_meetings"), where("status", "==", "held"));
    const unsubMeetings = onSnapshot(qMeetings, snap => {
      setBoardMeetings(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      );
      meetingsReady = true;
      finishLoading();
    }, err => {
      console.error("board_meetings:", err);
      setBoardMeetings([]);
      meetingsReady = true;
      finishLoading();
    });

    return () => { unsubChecks(); unsubLegacy(); unsubEmps(); unsubMeetings(); };
  }, []);

  const sourceTransactions = useMemo(
    () => mergeIssuedChecksSources(issuedChecks, legacyTransactions),
    [issuedChecks, legacyTransactions]
  );

  const normalizedSourceTransactions = useMemo(() => {
    const grouped = new Map();

    sourceTransactions.forEach((tx) => {
      const key = getSettlementSourceKey(tx);
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, tx);
        return;
      }

      if (current.isSettled && !tx.isSettled) {
        grouped.set(key, tx);
        return;
      }

      if (Boolean(current.isSettled) === Boolean(tx.isSettled)) {
        const currentUpdatedAt = String(current.updatedAt || current.settlementDate || current.date || "");
        const nextUpdatedAt = String(tx.updatedAt || tx.settlementDate || tx.date || "");
        if (nextUpdatedAt >= currentUpdatedAt) grouped.set(key, tx);
      }
    });

    return Array.from(grouped.values());
  }, [sourceTransactions]);

  const getIssuedCheckDocId = (tx) => {
    if (!tx) return "";
    if (tx.legacySourceId) return tx.id;
    return isLegacyCheckType(tx.type) ? buildLegacyIssuedCheckId(tx.id) : tx.id;
  };

  const buildIssuedCheckRecord = (tx, overrides = {}) => {
    const now = new Date().toISOString();
    const normalizedType = normalizeIssuedCheckType(tx?.type);
    const requiresSettlement = normalizeRequiresSettlement(tx);
    const targetId = getIssuedCheckDocId(tx);
    const isLegacySource = isLegacyCheckType(tx?.type) && !tx?.legacySourceId;

    return {
      ...tx,
      ...overrides,
      id: targetId,
      type: normalizedType,
      party: getIssuedCheckDisplayParty(tx),
      requires_settlement: requiresSettlement,
      requiresSettlement,
      settlement_mode:
        tx?.settlement_mode ||
        tx?.settlementMode ||
        getSettlementMode(
          normalizedType,
          requiresSettlement ?? getDefaultRequiresSettlement(normalizedType)
        ),
      updatedAt: now,
      createdAt: tx?.createdAt || now,
      state: tx?.state || "posted",
      legacySourceId: tx?.legacySourceId || (isLegacySource ? tx.id : tx?.legacySourceId),
      sourceTransactionId:
        tx?.sourceTransactionId || (isLegacySource ? tx.id : tx?.sourceTransactionId),
      legacySourceCollection:
        tx?.legacySourceCollection || (isLegacySource ? "transactions" : tx?.legacySourceCollection),
      migratedFromLegacy: Boolean(tx?.migratedFromLegacy || isLegacySource),
      originalLegacyType:
        tx?.originalLegacyType || (isLegacySource ? tx.type : tx?.originalLegacyType),
    };
  };

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const selectedMeeting = useMemo(() => boardMeetings.find(m => m.id === expMeetingId) || null, [boardMeetings, expMeetingId]);

  const allowanceReferenceDate = useMemo(() => {
    if (expCat === "بدل انتقال") return expDate || getTodayISO();
    if (expCat === "بدل جلسات" && selectedMeeting?.date) return selectedMeeting.date;
    return getTodayISO();
  }, [expCat, expDate, selectedMeeting]);

  const historicalMeetingMembers = useMemo(() => {
    if (!selectedMeeting?.attendees?.length) return [];
    const employeesMap = new Map(employees.map((employee) => [employee.id, employee]));
    return selectedMeeting.attendees
      .map((memberId) => employeesMap.get(memberId))
      .filter(Boolean);
  }, [employees, selectedMeeting]);

  const activeBoardMembers = useMemo(
    () => employees.filter((employee) => isBoardMemberEligibleForSettlementDate(employee, allowanceReferenceDate)),
    [employees, allowanceReferenceDate]
  );

  const selectableBoardMembers = useMemo(() => {
    if (expCat !== "بدل جلسات") return activeBoardMembers;

    const merged = [...historicalMeetingMembers, ...activeBoardMembers];
    const uniqueMembers = new Map();
    merged.forEach((member) => {
      if (member?.id && !uniqueMembers.has(member.id)) uniqueMembers.set(member.id, member);
    });
    return Array.from(uniqueMembers.values());
  }, [activeBoardMembers, expCat, historicalMeetingMembers]);

  useEffect(() => {
    if (expCat === "بدل انتقال") {
      setSelectedMembers(activeBoardMembers.map(m => m.id));
      setExpMeetingId("");
      return;
    }

    if (expCat === "بدل جلسات") {
      if (selectedMeeting?.attendees?.length) {
        const allowedIds = new Set(selectableBoardMembers.map((member) => member.id));
        setSelectedMembers(selectedMeeting.attendees.filter((memberId) => allowedIds.has(memberId)));
      } else {
        setSelectedMembers([]);
      }
      return;
    }

    if (isMeetingAllowanceCategory(expCat)) {
      setSelectedMembers([]);
      return;
    }

    setSelectedMembers([]);
    setExpMeetingId("");
  }, [expCat, activeBoardMembers, selectableBoardMembers, selectedMeeting]);

  useEffect(() => {
    if (
      isMeetingAllowanceCategory(expCat) &&
      selectedMeeting?.date &&
      !editingExpense?.id &&
      (!expDate || expDate === getTodayISO())
    ) {
      setExpDate(selectedMeeting.date);
    }
  }, [editingExpense?.id, expCat, expDate, selectedMeeting]);

  const archivedSettlements = useMemo(
    () => normalizedSourceTransactions.filter((tx) => normalizeRequiresSettlement(tx) && Boolean(tx.isSettled)),
    [normalizedSourceTransactions]
  );
  const editingSettlement = useMemo(() => archivedSettlements.find(t => t.id === editingSettlementId) || null, [archivedSettlements, editingSettlementId]);
  const archiveYears = useMemo(
    () => [...new Set(archivedSettlements.map(s => getYearValue(getSettlementApprovalDate(s))).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [archivedSettlements]
  );
  const filteredArchivedSettlements = useMemo(() => {
    return archivedSettlements
      .filter((s) => {
        const person = s.employeeName || s.party || "";
        const checkNo = String(s.checkNo || "");
        const refDate = getSettlementApprovalDate(s);
        const searchOk = !archiveSearch || person.includes(archiveSearch) || checkNo.includes(archiveSearch);
        const monthOk = archiveMonth === "all" || getMonthValue(refDate) === archiveMonth;
        const yearOk = archiveYear === "all" || getYearValue(refDate) === archiveYear;
        return searchOk && monthOk && yearOk;
      })
      .sort((a, b) => {
        const timeDiff = getSettlementSortTimestamp(b) - getSettlementSortTimestamp(a);
        if (timeDiff !== 0) return timeDiff;
        return String(getSettlementApprovalDate(b)).localeCompare(String(getSettlementApprovalDate(a)));
      });
  }, [archivedSettlements, archiveMonth, archiveSearch, archiveYear]);
  
  const getPrevBalance = (empId, currentTxnId, currentTxn = null) => {
    if (!empId) return 0;
    const currentChequeDateTimestamp = getDateTimestamp(getSettlementChequeDate(currentTxn || {}));
    const currentChequeNumber = getSettlementChequeNumber(currentTxn || {});

    const history = archivedSettlements
      .filter((settlement) => {
        if (settlement.employeeId !== empId || settlement.id === currentTxnId) return false;
        const settlementChequeDateTimestamp = getDateTimestamp(getSettlementChequeDate(settlement));
        const settlementChequeNumber = getSettlementChequeNumber(settlement);

        if (!currentChequeDateTimestamp || !settlementChequeDateTimestamp) return true;
        if (settlementChequeDateTimestamp < currentChequeDateTimestamp) return true;
        if (settlementChequeDateTimestamp > currentChequeDateTimestamp) return false;

        if (!currentChequeNumber || !settlementChequeNumber) return true;
        return settlementChequeNumber < currentChequeNumber;
      })
      .sort(compareSettlementSequenceDesc);

    const latestSettlement = history[0];
    return latestSettlement && getSettlementReturnMode(latestSettlement) === "carry_forward"
      ? Number(latestSettlement.settlementReturned || 0)
      : 0;
  };

  const openAdvances = useMemo(
    () =>
      normalizedSourceTransactions
        .filter((t) => normalizeRequiresSettlement(t) && !t.isSettled && (t.state === "posted" || t.state === "approved" || !t.state))
        .map((adv) => ({ ...adv, prevBalance: getPrevBalance(adv.employeeId, adv.id, adv) })),
    [normalizedSourceTransactions, archivedSettlements]
  );
  const currentTxnOptions = useMemo(() => {
    const txMap = new Map();
    if (editingSettlement) txMap.set(editingSettlement.id, { ...editingSettlement, prevBalance: getPrevBalance(editingSettlement.employeeId, editingSettlement.id, editingSettlement) });
    openAdvances.forEach(adv => {
      if (!txMap.has(adv.id)) txMap.set(adv.id, adv);
    });
    return Array.from(txMap.values());
  }, [editingSettlement, openAdvances, archivedSettlements]);

  const selectedTxn = useMemo(() => currentTxnOptions.find(a => a.id === selAdvId) || null, [currentTxnOptions, selAdvId]);
  const currentSettlementTxnId = selectedTxn?.id || editingSettlementId || "";
  const editingExpenseAmount = Number(editingExpense?.amount || 0);

  const blockedMeetingIdsByType = useMemo(() => {
    const result = {
      sessions: new Set(),
      hospitality: new Set(),
    };

    archivedSettlements.forEach((tx) => {
      if (!normalizeRequiresSettlement(tx) || tx.id === currentSettlementTxnId) return;

      (tx.settlementExpenses || []).forEach((expense) => {
        const allowanceType = getMeetingAllowanceType(expense.category);
        const meetingId = String(expense.meetingId || "").trim();
        if (!allowanceType || !meetingId) return;
        result[allowanceType].add(meetingId);
      });
    });

    expenses.forEach((expense) => {
      if (editingExpense?.id && expense.id === editingExpense.id) return;
      const allowanceType = getMeetingAllowanceType(expense.category);
      const meetingId = String(expense.meetingId || "").trim();
      if (!allowanceType || !meetingId) return;
      result[allowanceType].add(meetingId);
    });

    return result;
  }, [archivedSettlements, currentSettlementTxnId, editingExpense, expenses]);

  const availableMeetings = useMemo(() => {
    const allowanceType = getMeetingAllowanceType(expCat);
    if (!allowanceType) return boardMeetings;

    return boardMeetings.filter((meeting) => !blockedMeetingIdsByType[allowanceType].has(String(meeting.id || "").trim()));
  }, [boardMeetings, blockedMeetingIdsByType, expCat]);

  const validateMeetingAllowanceExpenses = () => {
    const seenMeetingIdsByType = {
      sessions: new Set(),
      hospitality: new Set(),
    };

    const reservedElsewhereByType = {
      sessions: new Set(),
      hospitality: new Set(),
    };

    archivedSettlements.forEach((tx) => {
      if (!normalizeRequiresSettlement(tx) || tx.id === currentSettlementTxnId) return;

      (tx.settlementExpenses || []).forEach((expense) => {
        const allowanceType = getMeetingAllowanceType(expense.category);
        const meetingId = String(expense.meetingId || "").trim();
        if (!allowanceType || !meetingId) return;
        reservedElsewhereByType[allowanceType].add(meetingId);
      });
    });

    for (const expense of expenses) {
      const allowanceType = getMeetingAllowanceType(expense.category);
      if (!allowanceType) continue;

      const meetingId = String(expense.meetingId || "").trim();
      const meetingTitle = expense.meetingTitle || boardMeetings.find((meeting) => meeting.id === meetingId)?.title || "الاجتماع المحدد";

      if (!meetingId) continue;

      if (reservedElsewhereByType[allowanceType].has(meetingId)) {
        return `تم صرف ${ALLOWANCE_TYPE_LABELS[allowanceType]} لهذا الاجتماع من قبل: ${meetingTitle}.`;
      }

      if (seenMeetingIdsByType[allowanceType].has(meetingId)) {
        return `تم إدراج ${ALLOWANCE_TYPE_LABELS[allowanceType]} لنفس الاجتماع أكثر من مرة داخل هذه التسوية: ${meetingTitle}.`;
      }

      seenMeetingIdsByType[allowanceType].add(meetingId);
    }

    return "";
  };

  useEffect(() => {
    if (!isMeetingAllowanceCategory(expCat) || !expMeetingId) return;
    if (availableMeetings.some((meeting) => meeting.id === expMeetingId)) return;
    setExpMeetingId("");
  }, [availableMeetings, expCat, expMeetingId]);

  // 🎯 حسابات التسوية الموحدة (شيك فقط / شيك + اشتراكات / عهدة مع رصيد مرحل)
  const settlementMode = selectedTxn?.settlement_mode || "none";
  const ADVANCE_AMT    = Number(selectedTxn?.advanceAmountBase || selectedTxn?.amount || 0);
  const PREV_BALANCE   = settlementMode === "carry_forward" ? Number(selectedTxn?.prevBalance || 0) : 0;
  const SUBS_AMT       = settlementMode === "check_plus_subscriptions" ? Number(collectedSubs || 0) : 0;
  const TOTAL_AVAILABLE= ADVANCE_AMT + PREV_BALANCE + SUBS_AMT;
  
  const spent          = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const remaining      = TOTAL_AVAILABLE - spent;
  const availableForExpense = remaining + editingExpenseAmount;
  const resetExpenseForm = () => {
    setEditingExpense(null);
    setExpAmt("");
    setExpCat(INITIAL_CATS[0]);
    setExpNotes("");
    setExpDate(getTodayISO());
    setExpFiles([]);
    setSelectedMembers([]);
    setExpMeetingId("");
  };

  useEffect(() => {
    if (selectedTxn) {
      setExpenses(selectedTxn.settlementExpenses || []);
      setCollectedSubs(selectedTxn.collectedSubscriptions || selectedTxn.memberSubscriptions || "");
      setSettlementDate(getSettlementApprovalDate(selectedTxn) || getTodayISO());
      const nextReturnMode = getSettlementReturnMode(selectedTxn);
      setReturnedActually(nextReturnMode === "cash_return");
      setReturnMode(nextReturnMode === "settled" ? "carry_forward" : nextReturnMode);
      setReturnDepositDate(selectedTxn.bankDepositDate || getTodayISO());
      setReturnDepositReference(selectedTxn.bankDepositReference || "");
      resetExpenseForm();
    } else {
      setExpenses([]);
      setCollectedSubs("");
      setSettlementDate(getTodayISO());
      resetSettlementReturnState("carry_forward");
      resetExpenseForm();
    }
  }, [selectedTxn]);

  const startEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpCat(expense.category || INITIAL_CATS[0]);
    setExpAmt(String(expense.amount || ""));
    setExpNotes(expense.notes || "");
    setExpDate(expense.date || getTodayISO());
    setExpFiles(Array.isArray(expense.files) ? expense.files : []);
    setSelectedMembers(Array.isArray(expense.boardMembers) ? expense.boardMembers : []);
    setExpMeetingId(expense.meetingId || "");
  };

  const addExpense = () => {
    if (editingExpense) {
      if (!expAmt || Number(expAmt) <= 0) return showToast("ط£ط¯ط®ظ„ ظ…ط¨ظ„ط؛ط§ظ‹ طµط­ظٹط­ط§ظ‹", "error");
      if (Number(expAmt) > availableForExpense) return showToast(`طھط¬ط§ظˆط²طھ ط§ظ„ظ…طھط§ط­! (${formatMoney(availableForExpense || 0)})`, "error");
      if (isMeetingAllowanceCategory(expCat) && !selectedMeeting) return showToast("ط§ط®طھط± ط§ظ„ط§ط¬طھظ…ط§ط¹ ط£ظˆظ„ط§ظ‹", "error");
      if (["ط¨ط¯ظ„ ط§ظ†طھظ‚ط§ظ„", "ط¨ط¯ظ„ ط¬ظ„ط³ط§طھ"].includes(expCat) && selectedMembers.length === 0) return showToast("ط§ط®طھط± ط¹ط¶ظˆ ظ…ط¬ظ„ط³ ظˆط§ط­ط¯ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„", "error");
      if (isMeetingAllowanceCategory(expCat) && blockedMeetingIdsByType[getMeetingAllowanceType(expCat)].has(String(selectedMeeting?.id || "").trim())) {
        return showToast(`طھظ… طµط±ظپ ${expCat === "ط¨ط¯ظ„ ط¬ظ„ط³ط§طھ" ? "ط¨ط¯ظ„ ط§ظ„ط¬ظ„ط³ط§طھ" : "ط¨ط¯ظ„ ط§ظ„ط¶ظٹط§ظپط©"} ظ„ظ‡ط°ط§ ط§ظ„ط§ط¬طھظ…ط§ط¹ ط¨ط§ظ„ظپط¹ظ„`, "error");
      }

      setExpenses(prev => prev.map(expense => (
        expense.id === editingExpense.id
          ? {
              ...expense,
              date: isMeetingAllowanceCategory(expCat) ? (expDate || selectedMeeting?.date || getTodayISO()) : expDate,
              amount: expAmt,
              category: expCat,
              notes: expNotes,
              meetingId: isMeetingAllowanceCategory(expCat) ? selectedMeeting?.id || "" : "",
              meetingTitle: isMeetingAllowanceCategory(expCat) ? selectedMeeting?.title || "" : "",
              boardMembers: ["ط¨ط¯ظ„ ط§ظ†طھظ‚ط§ظ„", "ط¨ط¯ظ„ ط¬ظ„ط³ط§طھ"].includes(expCat) ? selectedMembers : [],
              allowancePerMember: ["ط¨ط¯ظ„ ط§ظ†طھظ‚ط§ظ„", "ط¨ط¯ظ„ ط¬ظ„ط³ط§طھ"].includes(expCat) && selectedMembers.length > 0
                ? Number(expAmt) / selectedMembers.length
                : 0,
              files: expFiles
            }
          : expense
      )));
      resetExpenseForm();
      showToast("طھظ… ط­ظپط¸ طھط¹ط¯ظٹظ„ ط¨ظ†ط¯ ط§ظ„ظ…طµط±ظˆظپ", "success");
      return;
    }
    if (!expAmt || Number(expAmt) <= 0) return showToast("أدخل مبلغاً صحيحاً", "error");
    if (Number(expAmt) > remaining) return showToast(`تجاوزت المتاح! (${formatMoney(remaining || 0)})`, "error");
    if (isMeetingAllowanceCategory(expCat) && !selectedMeeting) return showToast("اختر الاجتماع أولاً", "error");
    if (["بدل انتقال", "بدل جلسات"].includes(expCat) && selectedMembers.length === 0) return showToast("اختر عضو مجلس واحد على الأقل", "error");
    if (isMeetingAllowanceCategory(expCat) && blockedMeetingIdsByType[getMeetingAllowanceType(expCat)].has(String(selectedMeeting?.id || "").trim())) {
      return showToast(`تم صرف ${expCat === "بدل جلسات" ? "بدل الجلسات" : "بدل الضيافة"} لهذا الاجتماع بالفعل`, "error");
    }

    setExpenses(prev => [...prev, {
      id: `e_${Date.now()}`,
      date: isMeetingAllowanceCategory(expCat) ? (expDate || selectedMeeting?.date || getTodayISO()) : expDate,
      amount: expAmt,
      category: expCat,
      notes: expNotes,
      meetingId: isMeetingAllowanceCategory(expCat) ? selectedMeeting?.id || "" : "",
      meetingTitle: isMeetingAllowanceCategory(expCat) ? selectedMeeting?.title || "" : "",
      boardMembers: ["بدل انتقال", "بدل جلسات"].includes(expCat) ? selectedMembers : [],
      allowancePerMember: ["بدل انتقال", "بدل جلسات"].includes(expCat) && selectedMembers.length > 0
        ? Number(expAmt) / selectedMembers.length
        : 0,
      files: expFiles
    }]);
    setExpAmt(""); setExpNotes(""); setExpFiles([]); setSelectedMembers([]); setExpMeetingId("");
    showToast("تم إدراج الفاتورة في الكشف", "success");
  };

  const executeRemoveExpense = () => {
    if (!expenseToDelete) return;
    if (editingExpense?.id === expenseToDelete.id) {
      resetExpenseForm();
    }
    setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
    setExpenseToDelete(null);
    showToast("تم حذف الفاتورة", "success");
  };

  const startEditSettlement = (settlement) => {
    setEditingSettlementId(settlement.id);
    setSelAdvId(settlement.id);
    setActiveTab("current");
    showToast("تم فتح التسوية في وضع التعديل", "success");
  };

  const executeDeleteSettlement = async () => {
    if (!settlementToDelete) return;
    setSaving(true);
    try {
      const targetId = getIssuedCheckDocId(settlementToDelete);
      const batch = writeBatch(db);
      batch.set(
        doc(db, "issued_checks", targetId),
        buildIssuedCheckRecord(settlementToDelete, {
          isSettled: false,
          settlementDate: "",
          settlementExpenses: [],
          settlementSpent: 0,
          settlementReturned: 0,
          returnedActually: false,
          returnMode: "carry_forward",
          returnedCashAmount: 0,
          bankDepositedAmount: 0,
          bankDepositDate: "",
          bankDepositReference: "",
          bankDepositTransactionId: "",
          prevBalanceUsed: 0,
          collectedSubscriptions: 0,
        }),
        { merge: true }
      );
      if (settlementToDelete.bankDepositTransactionId) {
        batch.delete(doc(db, "transactions", settlementToDelete.bankDepositTransactionId));
      }
      await batch.commit();
      await logAuditEvent("settlement_deleted", {
        transactionId: targetId,
        party: settlementToDelete.employeeName || settlementToDelete.party || "",
        settlementDate: settlementToDelete.settlementDate || "",
        type: settlementToDelete.type || "",
        deletedDepositTransactionId: settlementToDelete.bankDepositTransactionId || "",
      });
      if (editingSettlementId === settlementToDelete.id || editingSettlementId === targetId) {
        setEditingSettlementId("");
        setSelAdvId("");
        setExpenses([]);
        setCollectedSubs("");
        resetSettlementReturnState("carry_forward");
        resetExpenseForm();
      }
      setSettlementToDelete(null);
      setActiveTab("current");
      showToast("تم حذف التسوية وإعادة العهدة إلى القائمة المفتوحة", "success");
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء حذف التسوية", "error");
    } finally {
      setSaving(false);
    }
  };

  // 🎯 ميزة الحفظ المؤقت للرجوع لها لاحقاً
  const handleSaveDraft = async () => {
    if (!selectedTxn) return;
    const validationError = validateMeetingAllowanceExpenses();
    if (validationError) return showToast(validationError, "error");
    setSaving(true);
    try {
      const targetId = getIssuedCheckDocId(selectedTxn);
      await setDoc(
        doc(db, "issued_checks", targetId),
        buildIssuedCheckRecord(selectedTxn, {
          settlementExpenses: expenses,
          collectedSubscriptions: SUBS_AMT,
        }),
        { merge: true }
      );
      await logAuditEvent("settlement_draft_saved", {
        transactionId: targetId,
        party: selectedTxn.employeeName || selectedTxn.party || "",
        expensesCount: expenses.length,
        type: selectedTxn.type || "",
      });
      showToast("تم حفظ الفواتير في العهدة بنجاح (يمكنك إغلاقها لاحقاً) ✓", "success");
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء الحفظ المؤقت", "error");
    } finally { setSaving(false); }
  };

  const openConfirmModal = () => {
    const validationError = validateMeetingAllowanceExpenses();
    if (validationError) return showToast(validationError, "error");

    if (remaining > 0) {
      const selectedReturnMode = getSettlementReturnMode(selectedTxn || {});
      setReturnedActually(selectedReturnMode === "cash_return");
      setReturnMode(selectedReturnMode === "settled" ? "carry_forward" : selectedReturnMode);
      setReturnDepositDate(selectedTxn?.bankDepositDate || settlementDate || getTodayISO());
      setReturnDepositReference(selectedTxn?.bankDepositReference || "");
    }

    setConfirmModalData({
      txnId: getIssuedCheckDocId(selectedTxn),
      party: getIssuedCheckDisplayParty(selectedTxn),
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
    const validationError = validateMeetingAllowanceExpenses();
    if (validationError) {
      setConfirmModalData(null);
      return showToast(validationError, "error");
    }
    if (confirmModalData.remaining > 0 && returnMode === "bank_deposit" && !returnDepositDate) {
      return showToast("حدد تاريخ الإيداع البنكي قبل اعتماد التسوية", "error");
    }
    
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const normalizedReturnMode =
        confirmModalData.remaining > 0 ? returnMode : "settled";
      const carryForwardAmount =
        normalizedReturnMode === "carry_forward" ? Number(confirmModalData.remaining || 0) : 0;
      const returnedCashAmount =
        normalizedReturnMode === "cash_return" ? Number(confirmModalData.remaining || 0) : 0;
      const bankDepositedAmount =
        normalizedReturnMode === "bank_deposit" ? Number(confirmModalData.remaining || 0) : 0;
      const depositTransactionId =
        normalizedReturnMode === "bank_deposit"
          ? (selectedTxn?.bankDepositTransactionId || confirmModalData.bankDepositTransactionId || doc(collection(db, "transactions")).id)
          : "";

      if (selectedTxn?.bankDepositTransactionId && normalizedReturnMode !== "bank_deposit") {
        batch.delete(doc(db, "transactions", selectedTxn.bankDepositTransactionId));
      }

      if (normalizedReturnMode === "bank_deposit" && bankDepositedAmount > 0) {
        batch.set(
          doc(db, "transactions", depositTransactionId),
          {
            id: depositTransactionId,
            type: "deposit",
            amount: bankDepositedAmount,
            date: returnDepositDate || settlementDate || getTodayISO(),
            bankReference: returnDepositReference.trim(),
            receiptNo: returnDepositReference.trim(),
            party: confirmModalData.party || "رد متبقي تسوية",
            employeeId: selectedTxn?.employeeId || "",
            employeeName: confirmModalData.party || "",
            state: "posted",
            sourceCollection: "transactions",
            settlementId: confirmModalData.txnId,
            sourceAdvanceId: confirmModalData.txnId,
            depositSource: "settlement_return",
            linkedCheckId: confirmModalData.txnId,
            notes: `إيداع متبقي تسوية ${confirmModalData.party || "عهدة"}${returnDepositReference.trim() ? ` - مرجع ${returnDepositReference.trim()}` : ""}`,
            createdAt: selectedTxn?.bankDepositTransactionId ? (selectedTxn?.bankDepositCreatedAt || selectedTxn?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      batch.set(
        doc(db, "issued_checks", confirmModalData.txnId),
        buildIssuedCheckRecord(selectedTxn, {
          isSettled: true,
          settlementDate: getLatestSettlementExpenseDate(expenses, settlementDate),
          settlementExpenses: expenses,
          settlementSpent: confirmModalData.spent,
          settlementReturned: carryForwardAmount,
          returnedActually: normalizedReturnMode === "cash_return",
          returnMode: normalizedReturnMode,
          returnedCashAmount,
          bankDepositedAmount,
          bankDepositDate: normalizedReturnMode === "bank_deposit" ? (returnDepositDate || settlementDate || getTodayISO()) : "",
          bankDepositReference: normalizedReturnMode === "bank_deposit" ? returnDepositReference.trim() : "",
          bankDepositTransactionId: normalizedReturnMode === "bank_deposit" ? depositTransactionId : "",
          bankDepositCreatedAt: normalizedReturnMode === "bank_deposit"
            ? (selectedTxn?.bankDepositCreatedAt || new Date().toISOString())
            : "",
          prevBalanceUsed: confirmModalData.prevBalance,
          advanceAmountBase: confirmModalData.advanceAmountBase,
          collectedSubscriptions: confirmModalData.collectedSubs,
          employeeName: confirmModalData.party,
        }),
        { merge: true }
      );

      await batch.commit();
      await logAuditEvent(editingSettlementId ? "settlement_updated" : "settlement_finalized", {
        transactionId: confirmModalData.txnId,
        party: confirmModalData.party || "",
        settlementDate: getLatestSettlementExpenseDate(expenses, settlementDate),
        spent: confirmModalData.spent,
        returned: carryForwardAmount,
        returnedActually: normalizedReturnMode === "cash_return",
        returnMode: normalizedReturnMode,
        returnedCashAmount,
        bankDepositedAmount,
        bankDepositDate: normalizedReturnMode === "bank_deposit" ? (returnDepositDate || settlementDate || getTodayISO()) : "",
        bankDepositReference: normalizedReturnMode === "bank_deposit" ? returnDepositReference.trim() : "",
        bankDepositTransactionId: normalizedReturnMode === "bank_deposit" ? depositTransactionId : "",
        expensesCount: expenses.length,
        type: confirmModalData.type || "",
      });

      showToast("تم إغلاق العهدة واعتماد البدلات داخل التسوية بنجاح ✓", "success");
      
      setConfirmModalData(null);
      setEditingSettlementId("");
      setSelAdvId("");
      setExpenses([]);
      setCollectedSubs("");
      resetSettlementReturnState("carry_forward");
      setActiveTab("archive");

    } catch (e) {
      console.error(e);
      showToast("حدث خطأ أثناء الاعتماد", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400">جاري تحميل البيانات...</div>;

  return (
    <div className={clsx("flex flex-col gap-4 max-w-7xl mx-auto pb-10", T.text)} dir="rtl">
      <BrandHeader sectionTitle="تسوية الشيكات" sectionHint="اعتماد التسويات ومتابعة الأرشيف للشيكات التي تتطلب تسوية" />
      
      {toast && (
        <div className={clsx("fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-white font-bold animate-in fade-in slide-in-from-top-4", toast.type === "error" ? "bg-rose-600" : "bg-teal-600")}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
          <span className="text-xs">{toast.msg}</span>
        </div>
      )}

      {settlementToDelete && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={clsx("w-full max-w-md p-6 rounded-3xl shadow-2xl border space-y-5 animate-in zoom-in-95", T.card)}>
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl"><AlertTriangle size={20}/></div>
              <div><h2 className="font-black text-sm">حذف تسوية معتمدة</h2><p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">سيتم إعادة العهدة إلى القائمة المفتوحة</p></div>
            </div>
            <p className="text-xs font-bold leading-relaxed">
              سيتم حذف التسوية الخاصة بـ <span className="font-black text-teal-600">{settlementToDelete.employeeName || settlementToDelete.party}</span> وإعادة الشيك إلى قائمة التسويات المفتوحة من جديد.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setSettlementToDelete(null)} className={clsx("flex-1 py-2.5 rounded-xl font-bold text-xs border shadow-sm", T.btn)}>إلغاء</button>
              <button onClick={executeDeleteSettlement} disabled={saving} className="flex-1 py-2.5 rounded-xl font-black text-xs bg-rose-600 text-white hover:bg-rose-700 shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>} حذف التسوية
              </button>
            </div>
          </div>
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
              هل أنت متأكد من حذف فاتورة <span className="font-black text-teal-600">({expenseToDelete.category})</span> بقيمة <span className="font-black text-rose-600">{formatMoney(expenseToDelete.amount || 0)}</span> من كشف التسوية؟
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
              <div><h2 className="font-black text-sm">{editingSettlementId ? "تأكيد حفظ تعديلات التسوية" : "تأكيد إغلاق العهدة نهائياً"}</h2><p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">التاريخ: {settlementDate}</p></div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"><p className="text-[9px] font-black text-slate-400 mb-1">المتاح الكلي</p><p className="text-xs font-black text-slate-700 dark:text-slate-300">{formatMoney(confirmModalData.totalAvailable || 0)}</p></div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800"><p className="text-[9px] font-black text-rose-400 mb-1">المصروف الفعلي</p><p className="text-xs font-black text-rose-600">{formatMoney(confirmModalData.spent || 0)}</p></div>
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800"><p className="text-[9px] font-black text-teal-500 mb-1">المتبقي النهائي</p><p className="text-xs font-black text-teal-600">{formatMoney(confirmModalData.remaining || 0)}</p></div>
            </div>

            {confirmModalData.remaining > 0 && (
              <div className="space-y-3 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <div>
                  <span className="text-amber-900 dark:text-amber-400 text-xs font-black block">
                    معالجة المتبقي ({formatMoney(confirmModalData.remaining || 0)})
                  </span>
                  <span className="block text-[9px] font-bold text-amber-600 mt-1 leading-relaxed">
                    اختر كيف سيتم إغلاق المتبقي داخل التسوية والمستندات المالية.
                  </span>
                </div>

                <div className="grid gap-2">
                  {[
                    {
                      id: "carry_forward",
                      label: "ترحيل للسلفة التالية",
                      hint: "يبقى المبلغ رصيدًا مرحلًا ويظهر في السلفة التالية.",
                    },
                    {
                      id: "cash_return",
                      label: "رد نقدي للخزينة",
                      hint: "يغلق المتبقي كمبلغ مردود نقدًا بدون حركة إيداع بنكية.",
                    },
                    {
                      id: "bank_deposit",
                      label: "إيداع بالبنك",
                      hint: "ينشئ حركة إيداع فعلية في كشف الحساب ويرتبط بمستند التسوية.",
                    },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={clsx(
                        "flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors",
                        returnMode === option.id
                          ? "border-teal-300 bg-white dark:bg-slate-900/40"
                          : "border-amber-100 bg-white/70 dark:bg-slate-900/20"
                      )}
                    >
                      <input
                        type="radio"
                        name="settlement-return-mode"
                        checked={returnMode === option.id}
                        onChange={() => {
                          setReturnMode(option.id);
                          setReturnedActually(option.id === "cash_return");
                          if (option.id !== "bank_deposit") {
                            setReturnDepositReference("");
                            setReturnDepositDate(settlementDate || getTodayISO());
                          }
                        }}
                        className="w-4 h-4 mt-0.5 accent-teal-600"
                      />
                      <div>
                        <span className="text-slate-800 dark:text-slate-100 text-xs font-black block">{option.label}</span>
                        <span className="block text-[9px] font-bold text-slate-500 mt-1 leading-relaxed">{option.hint}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {returnMode === "bank_deposit" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 pr-1">تاريخ الإيداع</label>
                      <ArabicDatePicker
                        value={returnDepositDate}
                        onChange={setReturnDepositDate}
                        placeholder="تاريخ الإيداع البنكي"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 pr-1">مرجع البنك / رقم الإيصال</label>
                      <input
                        type="text"
                        value={returnDepositReference}
                        onChange={(e) => setReturnDepositReference(e.target.value)}
                        placeholder="مثال: 5412/بنك"
                        className={clsx("w-full px-3 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 focus:border-teal-500 h-[38px]", T.inp)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setConfirmModalData(null)} className={clsx("flex-1 py-2.5 rounded-xl font-bold text-xs border shadow-sm", T.btn)}>رجوع</button>
              <button onClick={handleFinalSettle} disabled={saving} className="flex-[2] py-2.5 rounded-xl font-black text-xs bg-teal-600 text-white hover:bg-teal-700 flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} {editingSettlementId ? "حفظ التعديلات" : "اعتماد نهائي وإغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* التبويبات العلوية */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-fit shadow-inner">
        <button onClick={() => setActiveTab("current")} className={clsx("px-6 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2", activeTab === "current" ? "bg-white dark:bg-slate-700 shadow-md text-teal-600" : "text-slate-500 hover:text-slate-700")}>
          <ReceiptText size={14}/> تسوية شيك {openAdvances.length > 0 && <span className="bg-amber-500 text-white text-[9px] rounded-full px-1.5 py-0.5 shadow-sm">{openAdvances.length}</span>}
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
                  <option value="">— الشيكات التي تتطلب تسوية —</option>
                  {currentTxnOptions.map(a => (
                    <option key={a.id} value={a.id}>
                      {getIssuedCheckDisplayParty(a)} {a.settlement_mode === "check_plus_subscriptions" ? "(رحلة)" : a.settlement_mode === "carry_forward" ? "(سلفة)" : "(شيك تسوية)"} — {a.date || "—"} — شيك: {a.checkNum ? formatMoney(a.checkNum) : "—"} — {formatMoney(a.amount)} {a.isSettled ? "— [تعديل تسوية]" : ""}
                    </option>
                  ))}
                </select>

                {editingSettlementId && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
                    <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">أنت الآن في وضع تعديل تسوية معتمدة</p>
                    <button onClick={() => { setEditingSettlementId(""); setSelAdvId(""); }} className="text-[10px] font-black text-amber-700 hover:text-rose-600 transition-colors">
                      إلغاء التعديل
                    </button>
                  </div>
                )}

                {settlementMode === "check_plus_subscriptions" && (
                  <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-1.5 animate-in fade-in">
                    <label className="text-[9px] font-black text-indigo-700 uppercase">اشتراكات الأعضاء</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute right-3 top-2.5 text-indigo-400"/>
                      <input type="number" value={collectedSubs} onChange={e => setCollectedSubs(e.target.value)} placeholder="مثال: 5000" className={clsx("w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none focus:ring-2 focus:border-indigo-400 h-[38px] bg-white", T.inp)}/>
                    </div>
                  </div>
                )}
              </div>

              {selectedTxn && (
                <div className={clsx("flex-1 w-full grid gap-2", settlementMode === "check_plus_subscriptions" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
                  <FinanceCard label={settlementMode === "carry_forward" ? "أصل السلفة" : "قيمة الشيك"} value={ADVANCE_AMT} color="slate" icon={ArrowDownRight}/>
                  
                  {settlementMode === "check_plus_subscriptions" ? (
                    <FinanceCard label="اشتراكات الأعضاء" value={SUBS_AMT} color="indigo" icon={Plus}/>
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
              
              {isMeetingAllowanceCategory(expCat) && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <FileText size={14}/> اختر الاجتماع المنعقد
                  </label>
                  <select value={expMeetingId} onChange={e => setExpMeetingId(e.target.value)} className={clsx("w-full px-2 py-2 rounded-lg border text-[10px] font-bold outline-none", T.sel)}>
                    <option value="">
                      {availableMeetings.length > 0 ? "-- اختر الاجتماع --" : "-- لا توجد اجتماعات متاحة لهذا البدل --"}
                    </option>
                    {availableMeetings.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title} — {m.date || "—"} — الحضور: {m.attendees?.length || 0}
                      </option>
                    ))}
                  </select>
                  {selectedMeeting && (
                    <p className="text-[9px] font-black text-indigo-600 mt-1 flex gap-1 bg-indigo-100/50 dark:bg-indigo-900/50 p-1.5 rounded">
                      <Info size={10} className="shrink-0"/>
                      {expCat === "بدل جلسات"
                        ? `سيتم توزيع ${formatMoney(expAmt || 0)} على ${selectedMeeting.attendees?.length || 0} من الحاضرين`
                        : `سيتم ربط بدل الضيافة بالاجتماع: ${selectedMeeting.title || "—"}`}
                    </p>
                  )}
                </div>
              )}

              {["بدل انتقال", "بدل جلسات"].includes(expCat) && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <Users size={14}/> {expCat === "بدل جلسات" ? "أعضاء الاجتماع المستحقون" : `تحديد أعضاء المجلس المستحقين لـ ${expCat}`}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-800">
                    {selectableBoardMembers.map(m => (
                      <label key={m.id} className="flex items-center gap-2 text-[10px] font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedMembers.includes(m.id)}
                          disabled={expCat === "بدل جلسات"}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMembers(p => [...p, m.id]);
                            else setSelectedMembers(p => p.filter(id => id !== m.id));
                          }}
                          className="accent-indigo-600"
                        />
                        {m.name.split(" ").slice(0,2).join(" ")}
                      </label>
                    ))}
                    {selectableBoardMembers.length === 0 && <p className="text-[9px] text-slate-400 p-1">لا يوجد أعضاء مجلس مستحقون لهذا التاريخ</p>}
                  </div>
                  {expAmt && selectedMembers.length > 0 && (
                    <p className="text-[9px] font-black text-indigo-600 mt-1 flex gap-1 bg-indigo-100/50 dark:bg-indigo-900/50 p-1.5 rounded">
                      <Info size={10} className="shrink-0"/> {expCat}: نصيب العضو {formatMoney(Number(expAmt) / selectedMembers.length)}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase pr-1">المبلغ</label>
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

              {editingExpense && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">جاري تعديل بند من كشف التسوية</p>
                  <button onClick={resetExpenseForm} className="text-[10px] font-black text-amber-700 hover:text-rose-600 transition-colors">
                    إلغاء التعديل
                  </button>
                </div>
              )}

              <button onClick={addExpense} disabled={!expAmt || Number(expAmt) <= 0 || Number(expAmt) > (editingExpense ? availableForExpense : remaining)} className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40">
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
                  <p className="text-lg font-black leading-none mt-0.5">{formatMoney(spent || 0)}</p>
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
                  ) : expenses.map((e) => (
                    <tr key={e.id} onClick={() => startEditExpense(e)} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer">
                      <td className="p-2.5 font-black text-teal-600">
                        {e.category}
                        {["بدل انتقال", "بدل جلسات"].includes(e.category) && <span className="block text-[8px] text-indigo-500 mt-0.5 font-bold">بدل مستقل داخل كشف التسوية</span>}
                        {e.meetingTitle && <span className="block text-[8px] text-sky-600 mt-0.5 font-bold">الاجتماع: {e.meetingTitle}</span>}
                        {e.boardMembers?.length > 0 && <span className="block text-[8px] text-indigo-500 mt-0.5 font-bold">لعدد {e.boardMembers.length} أعضاء</span>}
                        {Number(e.allowancePerMember || 0) > 0 && <span className="block text-[8px] text-amber-600 mt-0.5 font-bold">نصيب العضو: {formatMoney(e.allowancePerMember)}</span>}
                      </td>
                      <td className="p-2.5">
                        <p className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{e.notes || "—"}</p>
                        <p className="text-[9px] font-black text-slate-400 mt-0.5">{e.date}</p>
                      </td>
                      <td className="p-2.5 font-black text-rose-600 text-sm">{formatMoney(e.amount || 0)}</td>
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
                  {remaining >= 0 ? `متبقي للرد: ${formatMoney(remaining)}` : `تجاوز للصرف: ${formatMoney(Math.abs(remaining))}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveDraft} disabled={saving || expenses.length === 0} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 border shadow-sm active:scale-95 disabled:opacity-40">
                  <Save size={14}/> حفظ مؤقت
                </button>
                <button onClick={openConfirmModal} disabled={expenses.length === 0} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5">
                  <CheckCircle2 size={16}/> {editingSettlementId ? "حفظ التعديلات" : "اعتماد نهائي"}
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
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-2.5 text-slate-400"/>
                <input type="text" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} placeholder="بحث بالمسؤول أو الشيك..." className={clsx("pr-9 pl-4 py-2 rounded-xl border text-[11px] font-bold outline-none focus:ring-2 w-56", T.inp)} />
              </div>
              <select value={archiveMonth} onChange={e => setArchiveMonth(e.target.value)} className={clsx("px-3 py-2 rounded-xl border text-[11px] font-bold outline-none", T.sel)}>
                <option value="all">كل الشهور</option>
                {ARABIC_MONTHS.map((month, idx) => (
                  <option key={month} value={String(idx + 1).padStart(2, "0")}>{month}</option>
                ))}
              </select>
              <select value={archiveYear} onChange={e => setArchiveYear(e.target.value)} className={clsx("px-3 py-2 rounded-xl border text-[11px] font-bold outline-none", T.sel)}>
                <option value="all">كل السنوات</option>
                {archiveYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <div className="px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-[10px] font-black border border-teal-100 dark:border-teal-800/40">
                النتائج: {filteredArchivedSettlements.length}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-right text-[11px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-700">
                <tr>{["الاعتماد","المسؤول (النوع)","التمويل","متاح","منصرف","المتبقي / الإغلاق",""].map((h, i) => <th key={i} className="p-3 font-black text-slate-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredArchivedSettlements.map(s => {
                  const sAdvance = Number(s.advanceAmountBase || s.amount || 0);
                  const sPrevBal = Number(s.prevBalanceUsed || 0);
                  const sSubs    = Number(s.collectedSubscriptions || 0);
                  const sAvailable = sAdvance + sPrevBal + sSubs;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
      <td className="p-3 font-bold text-slate-500 whitespace-nowrap">{getSettlementApprovalDate(s) || "—"}</td>
                      <td className="p-3 font-black text-slate-800 dark:text-slate-100">
                        {s.employeeName || s.party}
                        <span className="block text-[8px] text-slate-400 mt-0.5">
                          {s.settlement_mode === "check_plus_subscriptions"
                            ? "رحلة"
                            : s.settlement_mode === "carry_forward"
                              ? "سلفة عادية"
                              : "شيك تسوية / فاعلية"}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-600">شيك: {formatMoney(sAdvance)}</p>
                        {s.settlement_mode === "check_plus_subscriptions" && sSubs > 0 && <p className="font-bold text-indigo-500 text-[9px]">اشتراكات: {formatMoney(sSubs)}</p>}
                        {s.settlement_mode !== "check_plus_subscriptions" && sPrevBal > 0 && <p className="font-bold text-amber-600 text-[9px]">مرحل: {formatMoney(sPrevBal)}</p>}
                      </td>
                      <td className="p-3 font-black text-teal-600 bg-teal-50/50 dark:bg-transparent rounded-lg">{formatMoney(sAvailable)}</td>
                      <td className="p-3 font-black text-rose-600">{formatMoney(s.settlementSpent || 0)}</td>
                      <td className="p-3 font-black">
                        <span className={clsx(getSettlementReturnMode(s) === "carry_forward" ? "text-emerald-600" : "text-slate-500")}>
                          {formatMoney(getSettlementEffectiveRemaining(s))}
                        </span>
                        <span className="block text-[8px] mt-0.5 text-slate-400 font-bold">{getSettlementReturnedLabel(s)}</span>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEditSettlement(s)} className="p-2 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors" title="تعديل"><Edit3 size={16}/></button>
                          <button onClick={() => setSettlementToDelete(s)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors" title="حذف"><RotateCcw size={16}/></button>
                          <button
                            onClick={() =>
                              printSettlementLocal({
                                advanceTxn: s,
                                expenses: s.settlementExpenses,
                                spent: s.settlementSpent,
                                remaining: getSettlementEffectiveRemaining(s),
                                prevBalance: sPrevBal,
                                collectedSubs: sSubs,
                                returnMode: getSettlementReturnMode(s),
                                bankDepositDate: s.bankDepositDate || "",
                                bankDepositReference: s.bankDepositReference || "",
                              })
                            }
                            className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
                            title="طباعة"
                          >
                            <Printer size={16}/>
                          </button>
                        </div>
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
