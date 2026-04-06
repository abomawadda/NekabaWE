/**
 * TreasuryLedger — كشف حساب الخزينة العام
 * ✅ إصلاح: عرض نوع "activity" وتفاصيل الشيك
 * ✅ تحسين: توافق كامل مع الموبايل
 * ✅ تحسين: تصدير Excel (XLSX)
 * ✅ تحسين: بطاقات ملخص محسّنة
 * ✅ إصلاح: عدم ظهور صفحة بيضاء (error boundary + loading)
 */

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import * as XLSX from "xlsx";
import {
  Printer, Wallet, TrendingUp, TrendingDown, FileText,
  Search, FileSpreadsheet, Download, RefreshCw, AlertTriangle
} from "lucide-react";
import clsx from "clsx";

// ─────────────────────────────────────────────
const OPENING_BALANCE = 42685.79;
const getTodayISO = () => new Date().toISOString().split("T")[0];

const getTypeLabel = (type, subType) => {
  switch (type) {
    case "deposit":  return "إيداع نقدي";
    case "refund":   return "رد سلفة";
    case "subs":     return "اشتراكات نشاط";
    case "aid":      return subType ? `إعانة (${subType.split(":")[0]})` : "إعانة";
    case "advance":  return "سلفة / عهدة";
    case "activity": return "شيك نشاط";
    default:         return "حركة مالية";
  }
};

const getBadgeColor = (type) => {
  switch (type) {
    case "deposit":
    case "subs":    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "refund":  return "bg-sky-100    text-sky-700    border-sky-200    dark:bg-sky-900/30    dark:text-sky-400";
    case "aid":     return "bg-rose-100   text-rose-700   border-rose-200   dark:bg-rose-900/30   dark:text-rose-400";
    case "advance": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400";
    case "activity":return "bg-amber-100  text-amber-700  border-amber-200  dark:bg-amber-900/30  dark:text-amber-400";
    default:        return "bg-slate-100  text-slate-700  border-slate-200";
  }
};

const isCredit = (type) => ["deposit", "refund", "subs"].includes(type);

// ─────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, isCount }) {
  const T = useT();
  return (
    <div className={clsx("flex items-center gap-2.5 p-3 rounded-2xl border shadow-sm transition-all", T.card)}>
      <div className={clsx("p-2 rounded-xl shrink-0", `bg-${color}-500/10`)}>
        <Icon size={18} className={`text-${color}-500`}/>
      </div>
      <div className="min-w-0">
        <p className={clsx("text-[9px] font-black uppercase", T.muted)}>{label}</p>
        <p className={clsx("text-lg font-black leading-none mt-0.5", `text-${color}-600 dark:text-${color}-400`)}>
          {isCount
            ? value
            : <>{Number(value || 0).toLocaleString()} <span className="text-[9px]">ج.م</span></>
          }
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Error Boundary
// ─────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center p-20 gap-3 text-rose-500">
        <AlertTriangle size={36}/>
        <p className="font-black text-sm">حدث خطأ في تحميل كشف الحساب</p>
        <p className="text-[10px] font-bold opacity-70">{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl font-black text-xs">
          إعادة المحاولة
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ─────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────
function TreasuryLedgerInner() {
  const T = useT();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [filterFrom, setFilterFrom]     = useState("");
  const [filterTo, setFilterTo]         = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [searchQ, setSearchQ]           = useState("");

  // Firestore listener
  useEffect(() => {
    try {
      const q = query(collection(db, "transactions"));
      const unsub = onSnapshot(
        q,
        snap => {
          setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
          setError(null);
        },
        err => {
          console.error(err);
          setError(err.message);
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  // بناء بيانات دفتر الأستاذ
  const ledgerData = useMemo(() => {
    let allEvents = [];
    const posted = transactions.filter(t => !t.state || t.state === "posted" || t.state === "approved");

    posted.forEach(tx => {
      const amt = Number(tx.advanceAmountBase || tx.amount || 0);
      allEvents.push({
        id:       tx.id,
        date:     tx.date || getTodayISO(),
        type:     tx.type,
        subType:  tx.aidCategory || tx.activityType || "",
        party:    tx.party || tx.employeeName || "—",
        notes:    tx.notes || tx.activityName || (tx.type === "advance" ? "صرف عهدة" : tx.type === "activity" ? "شيك نشاط" : ""),
        checkNum: tx.checkNum || "—",
        credit:   isCredit(tx.type) ? amt : 0,
        debit:    !isCredit(tx.type) ? amt : 0,
      });

      // رد السلفة / المتبقي
      if (["advance", "activity"].includes(tx.type) && tx.isSettled && Number(tx.settlementReturned || 0) > 0) {
        allEvents.push({
          id: `${tx.id}_refund`, date: tx.settlementDate || tx.date, type: "refund", subType: "",
          party: tx.employeeName || tx.party,
          notes: `توريد متبقي تسوية (${tx.date})`,
          checkNum: "إيصال",
          credit: Number(tx.settlementReturned), debit: 0,
        });
      }

      // اشتراكات النشاط
      if (tx.type === "activity" && tx.isSettled && Number(tx.collectedSubscriptions || 0) > 0) {
        allEvents.push({
          id: `${tx.id}_subs`, date: tx.settlementDate || tx.date, type: "subs", subType: "",
          party: tx.employeeName || tx.party,
          notes: `توريد اشتراكات نشاط (${tx.date})`,
          checkNum: "إيصال",
          credit: Number(tx.collectedSubscriptions), debit: 0,
        });
      }
    });

    allEvents.sort((a, b) => a.date.localeCompare(b.date));

    let running = OPENING_BALANCE;
    let periodOpening = OPENING_BALANCE;
    let periodCredit = 0, periodDebit = 0;
    const events = [];

    allEvents.forEach(e => {
      if (filterFrom && e.date < filterFrom) {
        running += (e.credit - e.debit);
        periodOpening = running;
      } else if (filterTo && e.date > filterTo) {
        // خارج النطاق بعد النهاية
      } else {
        running += (e.credit - e.debit);
        e.balance = running;

        const matchType =
          filterType === "all" ||
          (filterType === "deposit"  && ["deposit", "refund", "subs"].includes(e.type)) ||
          (filterType === "expense"  && e.type === "aid") ||
          (filterType === "activity" && e.type === "activity") ||
          (filterType === "advance"  && e.type === "advance");

        const matchSearch =
          !searchQ ||
          e.party.toLowerCase().includes(searchQ.toLowerCase()) ||
          e.notes?.toLowerCase().includes(searchQ.toLowerCase()) ||
          e.subType?.toLowerCase().includes(searchQ.toLowerCase()) ||
          e.checkNum?.toString().includes(searchQ);

        if (matchType && matchSearch) {
          periodCredit += e.credit;
          periodDebit  += e.debit;
          events.push(e);
        }
      }
    });

    return {
      events,
      finalBalance: running,
      periodOpeningBalance: periodOpening,
      periodCredit,
      periodDebit,
    };
  }, [transactions, filterFrom, filterTo, filterType, searchQ]);

  // طباعة كشف الحساب
  const handlePrint = () => {
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }

    const rowsHtml = ledgerData.events.map((e, i) => `
      <tr style="${i % 2 === 0 ? "background:#f8fafc;" : ""}">
        <td style="text-align:center;">${e.date}</td>
        <td style="text-align:center;">${getTypeLabel(e.type, e.subType)}</td>
        <td style="text-align:center;">${e.checkNum}</td>
        <td style="text-align:right; padding-right:8px;">${e.party}<br/><small style="color:#64748b;">${e.notes || ""}</small></td>
        <td style="text-align:left; color:#059669;">${e.credit > 0 ? e.credit.toLocaleString() : "—"}</td>
        <td style="text-align:left; color:#e11d48;">${e.debit > 0 ? e.debit.toLocaleString() : "—"}</td>
        <td style="text-align:left; font-weight:900;">${(e.balance || 0).toLocaleString()}</td>
      </tr>
    `).join("");

    win.document.write(`
      <!DOCTYPE html><html lang="ar" dir="rtl">
      <head><meta charset="UTF-8"><title>كشف حساب الخزينة</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        * { font-family: 'Cairo', sans-serif; margin:0; padding:0; box-sizing:border-box; }
        body { padding:15px; font-size:11px; color:#1e293b; }
        .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #1e293b; padding-bottom:12px; margin-bottom:20px; }
        .header h1 { font-size:18px; font-weight:900; }
        .header p  { font-size:10px; color:#64748b; font-weight:700; }
        .info-bar  { display:flex; justify-content:space-between; background:#f1f5f9; padding:6px 10px; border-radius:6px; margin-bottom:15px; font-size:10px; font-weight:700; }
        table { width:100%; border-collapse:collapse; margin-bottom:15px; }
        th { background:#1e293b; color:#fff; padding:7px 5px; text-align:center; font-weight:900; border:1px solid #334155; font-size:11px; }
        td { border:1px solid #cbd5e1; padding:5px 6px; vertical-align:middle; font-size:10px; }
        .opening-row td { background:#f0fdf4; font-weight:900; color:#166534; }
        .closing-row td { background:#1e293b; color:#fff; font-weight:900; }
        .signatures { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:40px; text-align:center; }
        .sig-box { font-size:10px; font-weight:700; color:#334155; }
        .sig-line { margin-top:35px; border-top:1px dashed #94a3b8; width:80%; margin-inline:auto; }
        @media print { @page { margin:8mm; size:A4 landscape; } body { padding:0; } }
      </style></head>
      <body>
        <div class="header">
          <div><h1>كشف حساب الخزينة العام (دفتر الأستاذ)</h1><p>النقابة العامة للاتصالات بالدقهلية</p></div>
          <div style="text-align:left; font-size:10px; font-weight:700; border:1px solid #1e293b; padding:8px 12px; border-radius:6px;">
            <div>الرصيد الختامي: <strong>${ledgerData.finalBalance.toLocaleString()} ج.م</strong></div>
          </div>
        </div>
        <div class="info-bar">
          <div>الفترة: ${filterFrom || "الافتتاح"} — ${filterTo || getTodayISO()}</div>
          <div>تاريخ التقرير: ${getTodayISO()}</div>
        </div>
        <table>
          <thead><tr>
            <th style="width:10%;">التاريخ</th>
            <th style="width:13%;">النوع</th>
            <th style="width:11%;">رقم الشيك</th>
            <th style="width:32%; text-align:right; padding-right:8px;">الجهة / البيان</th>
            <th style="width:11%; text-align:left;">وارد (+)</th>
            <th style="width:11%; text-align:left;">منصرف (-)</th>
            <th style="width:12%; text-align:left;">الرصيد</th>
          </tr></thead>
          <tbody>
            <tr class="opening-row"><td colspan="6">الرصيد الافتتاحي للفترة:</td><td style="text-align:left;">${ledgerData.periodOpeningBalance.toLocaleString()}</td></tr>
            ${rowsHtml}
            <tr class="closing-row">
              <td colspan="4">الإجماليات والرصيد الختامي</td>
              <td style="text-align:left; color:#34d399;">${ledgerData.periodCredit.toLocaleString()}</td>
              <td style="text-align:left; color:#f87171;">${ledgerData.periodDebit.toLocaleString()}</td>
              <td style="text-align:left; color:#5eead4;">${ledgerData.finalBalance.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div class="signatures">
          ${["مُدخل البيانات","المراجعة المالية","أمين الصندوق","رئيس النقابة"].map(s => `
            <div class="sig-box">${s}<div class="sig-line"></div></div>
          `).join("")}
        </div>
        <script>window.onload=()=>{setTimeout(()=>window.print(),500);}</script>
      </body></html>
    `);
    win.document.close();
  };

  // تصدير Excel
  const handleExport = () => {
    const rows = ledgerData.events.map(e => ({
      "التاريخ":      e.date,
      "النوع":        getTypeLabel(e.type, e.subType),
      "رقم الشيك":   e.checkNum,
      "الجهة":        e.party,
      "البيان":       e.notes,
      "وارد":         e.credit > 0 ? e.credit : "",
      "منصرف":        e.debit > 0 ? e.debit : "",
      "الرصيد":       e.balance,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الخزينة");
    XLSX.writeFile(wb, `كشف_الخزينة_${filterFrom || "كامل"}_${filterTo || getTodayISO()}.xlsx`);
  };

  // ─── Render states ───────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-3 text-slate-400">
      <RefreshCw size={32} className="animate-spin text-teal-500"/>
      <p className="font-black text-sm">جاري تحميل كشف الحساب...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center p-20 gap-3 text-rose-500">
      <AlertTriangle size={36}/>
      <p className="font-black text-sm">خطأ في الاتصال بالخادم</p>
      <p className="text-[10px] font-bold opacity-70">{error}</p>
    </div>
  );

  // ─── Main Render ──────────────────────────────
  return (
    <div className={clsx("flex flex-col gap-3 max-w-7xl mx-auto pb-10", T.text)} dir="rtl">

      {/* ── 1. ملخص الخزينة ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard
          label="الرصيد الفعلي"
          value={ledgerData.finalBalance}
          icon={Wallet}
          color={ledgerData.finalBalance >= 0 ? "teal" : "rose"}
        />
        <StatCard label="وارد الفترة"    value={ledgerData.periodCredit} icon={TrendingUp}   color="emerald"/>
        <StatCard label="منصرف الفترة"   value={ledgerData.periodDebit}  icon={TrendingDown}  color="rose"/>
        <StatCard label="حركات الكشف"   value={ledgerData.events.length} icon={FileText}     color="amber" isCount/>
      </div>

      {/* ── 2. لوحة التحكم ── */}
      <div className={clsx("p-3 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between", T.card)}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-xl text-teal-600">
            <FileSpreadsheet size={18}/>
          </div>
          <div>
            <h1 className="text-sm font-black">كشف حساب الخزينة</h1>
            <p className="text-[9px] font-bold text-slate-400">دفتر الأستاذ التفصيلي</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* نطاق التاريخ */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="w-28"><ArabicDatePicker label="" value={filterFrom} onChange={setFilterFrom} maxVal={filterTo || getTodayISO()} /></div>
            <span className="text-[9px] text-slate-400 font-bold">إلى</span>
            <div className="w-28"><ArabicDatePicker label="" value={filterTo} onChange={setFilterTo} minVal={filterFrom} maxVal={getTodayISO()} /></div>
          </div>
          {/* تصدير */}
          <button onClick={handleExport} disabled={ledgerData.events.length === 0}
            className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl font-black text-[10px] shadow-sm flex items-center gap-1.5 h-[38px] transition-all active:scale-95 disabled:opacity-50 border border-emerald-200">
            <Download size={13}/> Excel
          </button>
          {/* طباعة */}
          <button onClick={handlePrint} disabled={ledgerData.events.length === 0}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-[10px] shadow-md flex items-center gap-1.5 h-[38px] transition-all active:scale-95 disabled:opacity-50">
            <Printer size={13}/> طباعة
          </button>
        </div>
      </div>

      {/* ── 3. شريط البحث والفلتر ── */}
      <div className={clsx("p-2.5 rounded-xl border shadow-sm flex flex-wrap justify-between items-center gap-2", T.card)}>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={12} className="absolute right-3 top-2.5 text-slate-400"/>
          <input
            type="text" value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="بحث: جهة، بيان، شيك..."
            className={clsx("w-full pr-8 pl-4 py-1.5 rounded-lg border text-[10px] font-bold outline-none focus:ring-2 focus:border-teal-500", T.inp)}
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-wrap">
          {[
            { id: "all",      label: "الكل"       },
            { id: "deposit",  label: "الوارد"     },
            { id: "expense",  label: "الإعانات"   },
            { id: "activity", label: "الأنشطة"    },
            { id: "advance",  label: "السلف"      },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className={clsx(
                "px-3 py-1 rounded-lg text-[9px] font-black transition-all whitespace-nowrap",
                filterType === f.id ? "bg-white dark:bg-slate-700 shadow-sm text-teal-600" : "text-slate-500"
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. الجدول ── */}
      <div className={clsx("rounded-2xl shadow-sm border overflow-hidden", T.card)}>
        {/* تلميح السحب للموبايل */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40">
          <span className="text-[9px] font-bold text-amber-600">← اسحب يساراً لرؤية كل الأعمدة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] min-w-[640px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
              <tr>
                <th className="p-2.5 font-black text-slate-500 w-24 text-center">التاريخ</th>
                <th className="p-2.5 font-black text-slate-500 text-center w-28">النوع</th>
                <th className="p-2.5 font-black text-slate-500 text-center w-20">رقم الشيك</th>
                <th className="p-2.5 font-black text-slate-500">الجهة / البيان</th>
                <th className="p-2.5 font-black text-emerald-600 text-center w-24">وارد (+)</th>
                <th className="p-2.5 font-black text-rose-600   text-center w-24">منصرف (-)</th>
                <th className="p-2.5 font-black text-teal-600   text-left  w-28 bg-slate-100/50 dark:bg-slate-800">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">

              {/* رصيد افتتاحي */}
              <tr className="bg-emerald-50/40 dark:bg-emerald-900/10">
                <td colSpan={6} className="p-2 text-emerald-700 font-bold text-[10px]">الرصيد الافتتاحي للفترة:</td>
                <td className="p-2 text-left text-emerald-700 font-black">{ledgerData.periodOpeningBalance.toLocaleString()}</td>
              </tr>

              {ledgerData.events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FileText size={32} className="opacity-20"/>
                      <p className="font-black text-xs">لا توجد حركات مالية</p>
                      <p className="text-[10px] font-bold">جرّب تغيير النطاق الزمني أو الفلتر</p>
                    </div>
                  </td>
                </tr>
              ) : ledgerData.events.map((row, i) => (
                <tr key={`${row.id}-${i}`}
                  className={clsx(
                    "hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors",
                    i % 2 === 0 ? "" : "bg-slate-50/30 dark:bg-slate-900/10"
                  )}>
                  <td className="p-2 text-center text-slate-500 font-bold whitespace-nowrap">{row.date}</td>

                  <td className="p-2 text-center">
                    <span className={clsx("px-1.5 py-0.5 rounded border block w-max mx-auto text-[9px] font-black whitespace-nowrap", getBadgeColor(row.type))}>
                      {getTypeLabel(row.type, row.subType)}
                    </span>
                  </td>

                  <td className="p-2 text-center font-black text-amber-600 text-[10px] whitespace-nowrap">{row.checkNum}</td>

                  <td className="p-2">
                    <p className="font-black text-slate-800 dark:text-slate-100 truncate max-w-[180px] md:max-w-[260px]">{row.party}</p>
                    {row.notes && <p className="text-[9px] text-slate-500 truncate max-w-[180px] md:max-w-[260px] mt-0.5">{row.notes}</p>}
                  </td>

                  <td className="p-2 text-center font-black text-emerald-600 whitespace-nowrap">
                    {row.credit > 0 ? row.credit.toLocaleString() : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-2 text-center font-black text-rose-600 whitespace-nowrap">
                    {row.debit > 0 ? row.debit.toLocaleString() : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={clsx(
                    "p-2 text-left font-black bg-slate-50/50 dark:bg-slate-800/50 whitespace-nowrap",
                    row.balance < 0 ? "text-rose-600" : "text-teal-700 dark:text-teal-300"
                  )}>
                    {(row.balance || 0).toLocaleString()}
                  </td>
                </tr>
              ))}

              {/* الإجماليات */}
              <tr className="bg-slate-900 dark:bg-slate-950 text-white font-black">
                <td colSpan={4} className="p-2.5 text-[11px]">الإجماليات والرصيد الختامي:</td>
                <td className="p-2.5 text-center text-emerald-400 whitespace-nowrap">{ledgerData.periodCredit.toLocaleString()}</td>
                <td className="p-2.5 text-center text-rose-400   whitespace-nowrap">{ledgerData.periodDebit.toLocaleString()}</td>
                <td className="p-2.5 text-left  text-teal-300   whitespace-nowrap">{ledgerData.finalBalance.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function TreasuryLedger() {
  return (
    <ErrorBoundary>
      <TreasuryLedgerInner/>
    </ErrorBoundary>
  );
}
