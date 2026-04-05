/**
 * TreasuryLedger — كشف الحساب التفصيلي (النسخة المضغوطة ذات الأعمدة المستقلة)
 * * التحسينات:
 * ✅ فصل نوع السند (مع عرض نوع الإعانة بالتفصيل) في عمود مستقل.
 * ✅ فصل رقم الشيك / المرجع في عمود مستقل.
 * ✅ تحديث كشف الطباعة البنكي ليتوافق مع الأعمدة الجديدة بدقة متناهية.
 */

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../app/providers/FirebaseProvider";
import { useT } from "../../app/providers/ThemeProvider";
import ArabicDatePicker from "../../ui/inputs/ArabicDatePicker";
import {
  Printer, Wallet, TrendingUp, TrendingDown, FileText, Search, FileSpreadsheet
} from "lucide-react";
import clsx from "clsx";

const OPENING_BALANCE = 42685.79;
const getTodayISO = () => new Date().toISOString().split("T")[0];

// ── دوال مساعدة لتسمية الأنواع وتلوينها ──
const getTypeLabel = (type, subType) => {
  switch(type) {
    case 'deposit': return 'إيداع نقدي';
    case 'refund': return 'رد سلفة';
    case 'subs': return 'اشتراكات نشاط';
    case 'aid': return subType ? `إعانة (${subType.split(':')[0]})` : 'إعانة';
    case 'advance': return 'سلفة / عهدة';
    case 'activity': return 'دعم نشاط';
    default: return 'حركة مالية';
  }
};

const getBadgeColor = (type) => {
  switch(type) {
    case 'deposit': 
    case 'subs': return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
    case 'refund': return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400";
    case 'aid': return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400";
    case 'advance': return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400";
    case 'activity': return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

function StatCard({ label, value, icon: Icon, color }) {
  const T = useT();
  return (
    <div className={clsx("flex items-center gap-2 p-2.5 rounded-xl border shadow-sm transition-all", T.card)}>
      <div className={clsx("p-2 rounded-lg shrink-0", `bg-${color}-500/10`)}>
        <Icon size={16} className={`text-${color}-500`} />
      </div>
      <div className="min-w-0">
        <p className={clsx("text-[9px] font-black uppercase", T.muted)}>{label}</p>
        <p className={clsx("text-base font-black leading-none mt-0.5", `text-${color}-600 dark:text-${color}-400`)}>
          {Number(value || 0).toLocaleString()} <span className="text-[9px]">ج.م</span>
        </p>
      </div>
    </div>
  );
}

export default function TreasuryLedger() {
  const T = useT();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const q = query(collection(db, "transactions"));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const ledgerData = useMemo(() => {
    let allEvents = [];
    const postedTxns = transactions.filter(t => t.state === "posted" || t.state === "approved" || !t.state);

    postedTxns.forEach(tx => {
      const baseAmt = Number(tx.advanceAmountBase || tx.amount || 0);
      allEvents.push({
        id: tx.id, 
        date: tx.date || getTodayISO(), 
        type: tx.type,
        subType: tx.aidCategory || "", // 🎯 التقاط نوع الإعانة الفرعي
        party: tx.party || tx.employeeName || "—",
        notes: tx.notes || (tx.type === "advance" ? "صرف عهدة" : tx.type === "activity" ? "سلفة نشاط" : ""),
        checkNum: tx.checkNum || "—", 
        credit: tx.type === "deposit" ? baseAmt : 0,
        debit: tx.type !== "deposit" ? baseAmt : 0,
      });

      if (["advance", "activity"].includes(tx.type) && tx.isSettled && tx.returnedActually && Number(tx.settlementReturned || 0) > 0) {
        allEvents.push({
          id: `${tx.id}_refund`, date: tx.settlementDate || tx.date, type: "refund", subType: "",
          party: tx.employeeName || tx.party, notes: `توريد متبقي تسوية (${tx.date})`,
          checkNum: "إيصال", credit: Number(tx.settlementReturned), debit: 0,
        });
      }
      if (tx.type === "activity" && tx.isSettled && Number(tx.collectedSubscriptions || 0) > 0) {
        allEvents.push({
          id: `${tx.id}_subs`, date: tx.settlementDate || tx.date, type: "subs", subType: "",
          party: tx.employeeName || tx.party, notes: `توريد اشتراكات نشاط (${tx.date})`,
          checkNum: "إيصال", credit: Number(tx.collectedSubscriptions), debit: 0,
        });
      }
    });

    allEvents.sort((a, b) => a.date.localeCompare(b.date));
    let runningBalance = OPENING_BALANCE;
    let periodOpeningBalance = OPENING_BALANCE;
    let filteredEvents = [];
    let periodCredit = 0, periodDebit = 0;

    allEvents.forEach(e => {
      if (filterFrom && e.date < filterFrom) {
        runningBalance += (e.credit - e.debit);
        periodOpeningBalance = runningBalance; 
      } else if (filterTo && e.date > filterTo) {
      } else {
        runningBalance += (e.credit - e.debit);
        e.balance = runningBalance;
        
        let matchType = (filterType === "all") || 
                        (filterType === "deposit" && ["deposit", "refund", "subs"].includes(e.type)) || 
                        (filterType === "expense" && e.type === "aid") || 
                        (filterType === "advance" && ["advance", "activity"].includes(e.type));
                        
        let matchSearch = !searchQ || 
                          e.party.toLowerCase().includes(searchQ.toLowerCase()) || 
                          e.notes?.toLowerCase().includes(searchQ.toLowerCase()) || 
                          e.subType.toLowerCase().includes(searchQ.toLowerCase()) || 
                          String(e.checkNum).includes(searchQ);
                          
        if (matchType && matchSearch) {
          filteredEvents.push(e);
          periodCredit += e.credit;
          periodDebit += e.debit;
        }
      }
    });
    return { events: filteredEvents, periodOpeningBalance, finalBalance: runningBalance, periodCredit, periodDebit };
  }, [transactions, filterFrom, filterTo, filterType, searchQ]);

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    const rowsHtml = ledgerData.events.map((e) => `
      <tr>
        <td style="text-align:center;">${e.date}</td>
        <td style="text-align:center; font-size:10px;"><strong>${getTypeLabel(e.type, e.subType)}</strong></td>
        <td style="text-align:center; font-size:11px; color:#b45309; font-weight:bold;">${e.checkNum}</td>
        <td style="font-size:10.5px;"><strong>${e.party}</strong><br><span style="font-size:9px; color:#64748b;">${e.notes || "—"}</span></td>
        <td style="text-align:left; color:#16a34a;">${e.credit > 0 ? e.credit.toLocaleString() : "—"}</td>
        <td style="text-align:left; color:#dc2626;">${e.debit > 0 ? e.debit.toLocaleString() : "—"}</td>
        <td style="text-align:left; font-weight:900; background-color:#f8fafc;">${e.balance.toLocaleString()}</td>
      </tr>
    `).join("");

    win.document.write(`
      <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كشف حساب</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { font-family: 'Cairo', sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
        body { padding: 20px; color: #0f172a; background: #fff; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        .header-text h1 { color: #0f766e; font-size: 18px; font-weight: 900; }
        .info-bar { display: flex; justify-content: space-between; background: #f1f5f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-weight: bold; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #f1f5f9; color: #000; padding: 6px 4px; text-align: center; font-weight: 700; border: 1px solid #000; font-size: 11px; }
        td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: middle; }
        .opening-row td { background: #f0fdf4 !important; font-weight: bold; }
        .closing-row td { background: #1e293b !important; color: #fff !important; font-weight: bold; }
        .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 30px; text-align: center; }
        .sig-box { font-size: 10px; font-weight: 700; }
        .sig-line { margin-top: 30px; border-top: 1px dashed #000; width: 80%; margin-left: auto; margin-right: auto; }
        @media print { @page { margin: 8mm; size: A4 portrait; } body { padding: 0; } }
      </style></head><body>
        <div class="header"><div class="header-text"><h1>كشف حساب الخزينة العام (دفتر الأستاذ)</h1><p>النقابة العامة للاتصالات بالدقهلية</p></div><div style="font-weight:900; font-size:10px; border:1px solid #000; padding:5px;">شعار النقابة</div></div>
        <div class="info-bar"><div>الفترة: ${filterFrom || 'البداية'} : ${filterTo || getTodayISO()}</div><div>تاريخ التقرير: ${getTodayISO()}</div></div>
        <table><thead><tr>
          <th style="width:10%;">التاريخ</th>
          <th style="width:12%;">النوع</th>
          <th style="width:12%;">رقم الشيك</th>
          <th style="width:30%; text-align:right;">الجهة / البيان</th>
          <th style="width:12%; text-align:left;">وارد (+)</th>
          <th style="width:12%; text-align:left;">منصرف (-)</th>
          <th style="width:12%; text-align:left;">الرصيد</th>
        </tr></thead><tbody>
          <tr class="opening-row"><td colspan="6">الرصيد الافتتاحي للفترة:</td><td style="text-align: left;">${ledgerData.periodOpeningBalance.toLocaleString()}</td></tr>
          ${rowsHtml}
          <tr class="closing-row"><td colspan="4">الإجماليات والرصيد الختامي</td><td style="text-align: left;">${ledgerData.periodCredit.toLocaleString()}</td><td style="text-align: left;">${ledgerData.periodDebit.toLocaleString()}</td><td style="text-align: left;">${ledgerData.finalBalance.toLocaleString()}</td></tr>
        </tbody></table>
        <div class="signatures">${["مُدخل البيانات", "المراجعة المالية", "أمين الصندوق", "رئيس النقابة"].map(s => `<div class="sig-box">${s}<div class="sig-line"></div></div>`).join("")}</div>
        <script>window.onload=()=>{setTimeout(()=>window.print(), 500);}</script>
      </body></html>
    `);
    win.document.close();
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-slate-400">جاري التحميل...</div>;

  return (
    <div className={clsx("flex flex-col gap-3 max-w-7xl mx-auto pb-10", T.text)} dir="rtl">
      
      {/* ── 1. ملخص الخزينة ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="الرصيد الفعلي" value={ledgerData.finalBalance} icon={Wallet} color={ledgerData.finalBalance >= 0 ? "teal" : "rose"} />
        <StatCard label="وارد الفترة" value={ledgerData.periodCredit} icon={TrendingUp} color="emerald" />
        <StatCard label="منصرف الفترة" value={ledgerData.periodDebit} icon={TrendingDown} color="rose" />
        <StatCard label="حركات الكشف" value={ledgerData.events.length} icon={FileText} color="amber" />
      </div>

      {/* ── 2. لوحة التحكم ── */}
      <div className={clsx("p-3 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 z-[100] relative", T.card)}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-600"><FileSpreadsheet size={18} /></div>
          <h1 className="text-sm font-black">كشف حساب الخزينة</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="w-28"><ArabicDatePicker label="" value={filterFrom} onChange={setFilterFrom} maxVal={filterTo || getTodayISO()} /></div>
            <div className="w-28"><ArabicDatePicker label="" value={filterTo} onChange={setFilterTo} minVal={filterFrom} maxVal={getTodayISO()} /></div>
          </div>
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-[10px] shadow-md flex items-center gap-1.5 h-[38px] transition-all active:scale-95">
            <Printer size={14}/> طباعة التقرير
          </button>
        </div>
      </div>

      {/* ── 3. شريط البحث ── */}
      <div className={clsx("p-2 rounded-xl border shadow-sm flex flex-wrap justify-between items-center gap-2 z-[90] relative", T.card)}>
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute right-3 top-2.5 text-slate-400"/>
          <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="بحث (الجهة، البيان، الشيك، النوع)..." className={clsx("w-full pr-8 pl-4 py-1.5 rounded-lg border text-[10px] font-bold outline-none focus:ring-2 focus:border-teal-500", T.inp)} />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {[ { id: "all", label: "الكل" }, { id: "deposit", label: "الوارد" }, { id: "expense", label: "المنصرف" }, { id: "advance", label: "السلف والأنشطة" } ].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)} className={clsx("px-3 py-1 rounded-md text-[9px] font-black transition-all", filterType === f.id ? "bg-white dark:bg-slate-700 shadow-sm text-teal-600" : "text-slate-500")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. الجدول ── */}
      <div className={clsx("rounded-2xl shadow-sm border overflow-hidden", T.card)}>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
              <tr>
                <th className="p-2.5 font-black text-slate-500 w-24 text-center">التاريخ</th>
                <th className="p-2.5 font-black text-slate-500 text-center w-28">النوع</th>
                <th className="p-2.5 font-black text-slate-500 text-center w-24">رقم الشيك</th>
                <th className="p-2.5 font-black text-slate-500">الجهة / البيان</th>
                <th className="p-2.5 font-black text-emerald-600 text-center w-24">وارد (+)</th>
                <th className="p-2.5 font-black text-rose-600 text-center w-24">منصرف (-)</th>
                <th className="p-2.5 font-black text-teal-600 text-left w-28 bg-slate-100/50 dark:bg-slate-800">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              <tr className="bg-emerald-50/30 font-bold">
                <td colSpan={6} className="p-2 text-emerald-700">الرصيد الافتتاحي للفترة:</td>
                <td className="p-2 text-left text-emerald-700">{ledgerData.periodOpeningBalance.toLocaleString()}</td>
              </tr>
              
              {ledgerData.events.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400 font-bold italic">لا توجد حركات</td></tr>
              ) : ledgerData.events.map((row, i) => (
                <tr key={row.id + i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="p-2 text-center text-slate-500 font-bold">{row.date}</td>
                  
                  {/* 🎯 عمود النوع الجديد */}
                  <td className="p-2 text-center font-bold text-slate-600 dark:text-slate-300 text-[10px]">
                    <span className={clsx("px-1.5 py-0.5 rounded border block w-max mx-auto", getBadgeColor(row.type))}>
                      {getTypeLabel(row.type, row.subType)}
                    </span>
                  </td>
                  
                  {/* 🎯 عمود الشيك الجديد */}
                  <td className="p-2 text-center font-black text-amber-600">{row.checkNum}</td>
                  
                  <td className="p-2">
                    <p className="font-black text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{row.party}</p>
                    <p className="text-[9px] text-slate-500 truncate max-w-[200px] mt-0.5">{row.notes}</p>
                  </td>
                  
                  <td className="p-2 text-center font-black text-emerald-600">{row.credit > 0 ? row.credit.toLocaleString() : "—"}</td>
                  <td className="p-2 text-center font-black text-rose-600">{row.debit > 0 ? row.debit.toLocaleString() : "—"}</td>
                  <td className="p-2 text-left font-black bg-slate-50/50 dark:bg-slate-800/50">{row.balance.toLocaleString()}</td>
                </tr>
              ))}
              
              <tr className="bg-slate-900 text-white font-black">
                <td colSpan={4} className="p-2.5">الإجماليات والرصيد الختامي:</td>
                <td className="p-2.5 text-center text-emerald-400">{ledgerData.periodCredit.toLocaleString()}</td>
                <td className="p-2.5 text-center text-rose-400">{ledgerData.periodDebit.toLocaleString()}</td>
                <td className="p-2.5 text-left text-teal-300">{ledgerData.finalBalance.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}